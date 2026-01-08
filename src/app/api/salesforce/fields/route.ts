import { NextResponse } from 'next/server';
import { getSalesforceToken } from '@/lib/salesforce';

/**
 * Get all fields on the Opportunity object to find the correct field names
 */
export async function GET() {
  try {
    const { token, instanceUrl } = await getSalesforceToken();

    // Describe the Opportunity object to get all fields
    const response = await fetch(
      `${instanceUrl}/services/data/v59.0/sobjects/Opportunity/describe`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ error: 'Failed to describe Opportunity', details: error }, { status: 500 });
    }

    const data = await response.json();

    // Filter to find date fields and fields with relevant keywords
    const dateFields = data.fields
      .filter((f: any) =>
        f.type === 'date' ||
        f.type === 'datetime' ||
        f.type === 'boolean' ||
        f.type === 'percent' ||
        f.name.toLowerCase().includes('award') ||
        f.name.toLowerCase().includes('contract') ||
        f.name.toLowerCase().includes('effective') ||
        f.name.toLowerCase().includes('install') ||
        f.name.toLowerCase().includes('budget') ||
        f.name.toLowerCase().includes('forecast') ||
        f.name.toLowerCase().includes('probability') ||
        f.name.toLowerCase().includes('manual')
      )
      .map((f: any) => ({
        name: f.name,
        label: f.label,
        type: f.type,
      }));

    return NextResponse.json({
      totalFields: data.fields.length,
      relevantFields: dateFields,
    });
  } catch (err) {
    console.error('Error describing Opportunity:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
