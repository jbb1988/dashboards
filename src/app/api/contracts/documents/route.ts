import { NextRequest, NextResponse } from 'next/server';

const NOTION_TOKEN = process.env.NOTION_API_KEY || '';
const DATABASE_ID = '206736c0-e519-4948-ad03-0786df66e7fc';

// Document types for contract management
const DOCUMENT_TYPES = [
  'Original Contract/RFP',
  'MARS Redlines',
  'Client Response',
  'Final Agreement',
  'Executed Contract',
  'Purchase Order',
];

interface Document {
  id: string;
  contractId: string;
  contractName: string;
  type: string;
  status: 'pending' | 'received' | 'reviewed' | 'final';
  uploadDate?: string;
  fileUrl?: string;
  notes?: string;
}

// In-memory storage (would be replaced with Notion database in production)
const documents: Document[] = [];

/**
 * GET - Fetch all documents or documents for a specific contract
 * Query param: contractId (optional)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get('contractId');

  try {
    let filteredDocs = documents;

    if (contractId) {
      filteredDocs = documents.filter(d => d.contractId === contractId);
    }

    // Sort by contract, then by document type order
    filteredDocs.sort((a, b) => {
      if (a.contractName !== b.contractName) {
        return a.contractName.localeCompare(b.contractName);
      }
      return DOCUMENT_TYPES.indexOf(a.type) - DOCUMENT_TYPES.indexOf(b.type);
    });

    return NextResponse.json({
      documents: filteredDocs,
      documentTypes: DOCUMENT_TYPES,
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

/**
 * POST - Create or update a document record
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contractId, contractName, type, status, fileUrl, notes } = body;

    if (!contractId || !type) {
      return NextResponse.json(
        { error: 'contractId and type are required' },
        { status: 400 }
      );
    }

    if (!DOCUMENT_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid document type. Must be one of: ${DOCUMENT_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Check if document already exists
    const existingIndex = documents.findIndex(
      d => d.contractId === contractId && d.type === type
    );

    const doc: Document = {
      id: existingIndex >= 0 ? documents[existingIndex].id : `doc-${Date.now()}`,
      contractId,
      contractName: contractName || 'Unknown Contract',
      type,
      status: status || 'pending',
      uploadDate: new Date().toISOString(),
      fileUrl,
      notes,
    };

    if (existingIndex >= 0) {
      documents[existingIndex] = doc;
    } else {
      documents.push(doc);
    }

    return NextResponse.json({ document: doc });
  } catch (error) {
    console.error('Error creating document:', error);
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
  }
}

/**
 * PATCH - Update document status
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { documentId, status, fileUrl, notes } = body;

    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
    }

    const docIndex = documents.findIndex(d => d.id === documentId);
    if (docIndex < 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (status) documents[docIndex].status = status;
    if (fileUrl) documents[docIndex].fileUrl = fileUrl;
    if (notes !== undefined) documents[docIndex].notes = notes;

    return NextResponse.json({ document: documents[docIndex] });
  } catch (error) {
    console.error('Error updating document:', error);
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
  }
}

/**
 * DELETE - Remove a document record
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
    }

    const docIndex = documents.findIndex(d => d.id === documentId);
    if (docIndex < 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    documents.splice(docIndex, 1);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}
