import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SLACK_WEBHOOK_URL = Deno.env.get("SLACK_WEBHOOK_URL")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface PandaDocWebhookPayload {
  event: string;
  data: {
    id: string;
    name: string;
    status: string;
    date_created: string;
    date_modified: string;
    date_completed?: string;
    expiration_date?: string;
    recipients?: Array<{
      email: string;
      first_name: string;
      last_name: string;
      company?: string;
    }>;
    template?: {
      id: string;
      name: string;
    };
    metadata?: Record<string, unknown>;
  };
}

async function getPandaDocToken(): Promise<string> {
  // First try to get from database
  const { data, error } = await supabase
    .from("pandadoc_config")
    .select("api_token, token_expires_at")
    .single();

  if (data && !error) {
    const expiresAt = new Date(data.token_expires_at);
    if (expiresAt > new Date()) {
      console.log("Using token from database (expires:", data.token_expires_at, ")");
      return data.api_token;
    }
    console.warn("Token from database has expired");
  }

  // Fallback to env var
  const envToken = Deno.env.get("PANDADOC_API_KEY");
  if (envToken) {
    console.log("Using token from environment variable");
    return envToken;
  }

  throw new Error("No valid PandaDoc token available");
}

async function downloadPandaDocPDF(documentId: string): Promise<Blob | null> {
  try {
    const token = await getPandaDocToken();

    const downloadResponse = await fetch(
      `https://api.pandadoc.com/public/v1/documents/${documentId}/download`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!downloadResponse.ok) {
      console.error("Failed to download PDF:", await downloadResponse.text());
      return null;
    }

    return await downloadResponse.blob();
  } catch (error) {
    console.error("Error downloading PDF:", error);
    return null;
  }
}

async function uploadToStorage(
  documentId: string,
  documentName: string,
  pdfBlob: Blob
): Promise<string | null> {
  try {
    const fileName = `pandadoc/${documentId}/${documentName.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;

    const { data, error } = await supabase.storage
      .from("documents")
      .upload(fileName, pdfBlob, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (error) {
      console.error("Storage upload error:", error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    console.error("Error uploading to storage:", error);
    return null;
  }
}

async function sendSlackNotification(document: {
  name: string;
  recipient_name: string;
  recipient_company: string;
  pdf_url: string | null;
  pandadoc_id: string;
  date_completed: string;
}): Promise<string | null> {
  try {
    const pandadocUrl = `https://app.pandadoc.com/a/#/documents/${document.pandadoc_id}`;

    const blocks: any[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "Proposal Approved!",
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Document:*\n${document.name}`,
          },
          {
            type: "mrkdwn",
            text: `*Recipient:*\n${document.recipient_name}`,
          },
          {
            type: "mrkdwn",
            text: `*Company:*\n${document.recipient_company || "N/A"}`,
          },
          {
            type: "mrkdwn",
            text: `*Completed:*\n${new Date(document.date_completed).toLocaleDateString()}`,
          },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "View in PandaDoc",
              emoji: true,
            },
            url: pandadocUrl,
            style: "primary",
          },
        ],
      },
    ];

    // Add PDF button if available
    if (document.pdf_url) {
      blocks[2].elements.push({
        type: "button",
        text: {
          type: "plain_text",
          text: "Download PDF",
          emoji: true,
        },
        url: document.pdf_url,
      });
    }

    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });

    if (!response.ok) {
      console.error("Slack notification failed:", await response.text());
      return null;
    }

    return new Date().toISOString();
  } catch (error) {
    console.error("Error sending Slack notification:", error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload: PandaDocWebhookPayload = await req.json();
    console.log("Received webhook:", JSON.stringify(payload, null, 2));

    // Only process document.completed events
    if (payload.event !== "document_state_changed" || payload.data.status !== "document.completed") {
      console.log(`Ignoring event: ${payload.event}, status: ${payload.data.status}`);
      return new Response(JSON.stringify({ message: "Event ignored" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const doc = payload.data;
    const isOrderForm = doc.name.toLowerCase().includes("order form");
    const documentType = isOrderForm ? "order_form" : "proposal";

    console.log(`Processing ${documentType}: ${doc.name}`);

    // Download PDF
    const pdfBlob = await downloadPandaDocPDF(doc.id);
    let pdfUrl: string | null = null;
    let storagePath: string | null = null;

    if (pdfBlob) {
      storagePath = `pandadoc/${doc.id}/${doc.name.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;
      pdfUrl = await uploadToStorage(doc.id, doc.name, pdfBlob);
    }

    // Get recipient info
    const recipient = doc.recipients?.[0];

    // Insert/update record in database
    const { data: insertedDoc, error: dbError } = await supabase
      .from("pandadoc_documents")
      .upsert(
        {
          pandadoc_id: doc.id,
          name: doc.name,
          document_type: documentType,
          status: doc.status,
          date_created: doc.date_created,
          date_modified: doc.date_modified,
          date_completed: doc.date_completed || new Date().toISOString(),
          expiration_date: doc.expiration_date,
          recipient_email: recipient?.email,
          recipient_name: recipient ? `${recipient.first_name} ${recipient.last_name}` : null,
          recipient_company: recipient?.company,
          pdf_url: pdfUrl,
          pdf_storage_path: storagePath,
          template_id: doc.template?.id,
          template_name: doc.template?.name,
          metadata: doc.metadata || {},
        },
        { onConflict: "pandadoc_id" }
      )
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      return new Response(JSON.stringify({ error: "Database error", details: dbError }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Send Slack notification for proposals only
    let slackNotified = false;
    if (!isOrderForm) {
      const slackNotifiedAt = await sendSlackNotification({
        name: doc.name,
        recipient_name: recipient ? `${recipient.first_name} ${recipient.last_name}` : "Unknown",
        recipient_company: recipient?.company || "",
        pdf_url: pdfUrl,
        pandadoc_id: doc.id,
        date_completed: doc.date_completed || new Date().toISOString(),
      });

      if (slackNotifiedAt) {
        slackNotified = true;
        await supabase
          .from("pandadoc_documents")
          .update({ slack_notified_at: slackNotifiedAt })
          .eq("pandadoc_id", doc.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        document_type: documentType,
        document_id: insertedDoc?.id,
        slack_notified: slackNotified,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
