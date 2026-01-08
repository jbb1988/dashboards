#!/usr/bin/env python3
"""
Reconciliation script: Compare Excel contracts vs Notion contracts
"""

import pandas as pd
import requests
import json
from datetime import datetime

# Configuration
import os
NOTION_TOKEN = os.environ.get('NOTION_API_KEY', '')
DATABASE_ID = '206736c0-e519-4948-ad03-0786df66e7fc'
EXCEL_FILE = '/Users/jbb/Downloads/report1767708526119.xls'

def get_notion_contracts():
    """Fetch all contracts from Notion"""
    headers = {
        'Authorization': f'Bearer {NOTION_TOKEN}',
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
    }

    url = f'https://api.notion.com/v1/databases/{DATABASE_ID}/query'
    all_results = []
    has_more = True
    start_cursor = None

    while has_more:
        body = {'page_size': 100}
        if start_cursor:
            body['start_cursor'] = start_cursor

        response = requests.post(url, headers=headers, json=body)
        data = response.json()

        all_results.extend(data.get('results', []))
        has_more = data.get('has_more', False)
        start_cursor = data.get('next_cursor')

    # Parse results
    contracts = []
    for page in all_results:
        props = page.get('properties', {})
        name = ''
        if props.get('Name', {}).get('title'):
            name = props['Name']['title'][0].get('plain_text', '') if props['Name']['title'] else ''

        value = props.get('Contract Value', {}).get('number', 0) or 0

        contracts.append({
            'id': page['id'],
            'name': name.strip(),
            'name_lower': name.strip().lower(),
            'value': value,
        })

    return contracts

def get_excel_contracts():
    """Parse Excel file (HTML table format)"""
    # Read HTML tables from the file
    dfs = pd.read_html(EXCEL_FILE)
    df = dfs[0]  # First table

    # The columns are in the first row (header)
    print(f"Columns found: {df.columns.tolist()}")

    # Group by Account Name and sum values
    contracts_dict = {}
    for _, row in df.iterrows():
        account_name = str(row.get('Account Name', '')).strip()

        # Get opportunity revenue value
        value = 0
        try:
            value = float(row.get('Est. Opportunity Rev.', 0) or 0)
        except:
            value = 0

        close_date = str(row.get('Contract Effective/Close Date', ''))
        stage = str(row.get('Calculated Stage', ''))
        sales_lead = str(row.get('Sales Lead (O)', ''))

        if account_name and account_name != 'nan':
            if account_name not in contracts_dict:
                contracts_dict[account_name] = {
                    'name': account_name,
                    'name_lower': account_name.lower(),
                    'value': 0,
                    'close_date': close_date,
                    'stage': stage,
                    'sales_lead': sales_lead,
                    'opportunity_count': 0,
                }
            contracts_dict[account_name]['value'] += value
            contracts_dict[account_name]['opportunity_count'] += 1

    return list(contracts_dict.values())

def normalize_name(name):
    """Normalize company name for matching"""
    name = name.lower().strip()
    # Remove common suffixes and patterns
    for suffix in [', inc.', ', inc', ' inc.', ' inc', ', llc', ' llc', ', ltd', ' ltd',
                   ' corporation', ' corp', ' company', ' co.', ', city of', ' city of',
                   ', town of', ' town of', ' department', ' dept', ' utilities', ' utility',
                   ' water district', ' water division', ' water works', ' waterworks',
                   ' water & sewer', ' water and sewer', ' mcc', ' m3', ' myc', ' (vf-10)',
                   ' (1 of 3)', ' (1 of 5)', ' (2 of 5)', ' (3 of 5)', '(console upgrade)',
                   ' - mcc only', ' mcc only', ' renewal', ' license']:
        name = name.replace(suffix, '')
    # Remove anything in parentheses at end
    import re
    name = re.sub(r'\s*\([^)]*\)\s*$', '', name)
    name = re.sub(r'\s*\[[^\]]*\]\s*$', '', name)
    # Clean extra whitespace
    name = ' '.join(name.split())
    return name.strip()

def reconcile():
    """Compare Excel and Notion contracts"""
    print("=" * 70)
    print("MARS CONTRACTS RECONCILIATION REPORT")
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    # Fetch data
    print("\nFetching Notion contracts...")
    notion_contracts = get_notion_contracts()
    print(f"Found {len(notion_contracts)} contracts in Notion")

    print("\nParsing Excel file...")
    excel_contracts = get_excel_contracts()
    print(f"Found {len(excel_contracts)} contracts in Excel")

    # Create normalized name sets
    notion_names = {normalize_name(c['name']): c for c in notion_contracts}
    excel_names = {normalize_name(c['name']): c for c in excel_contracts}

    # Find matches and differences
    matched = []
    only_in_excel = []
    only_in_notion = []

    for norm_name, excel_contract in excel_names.items():
        if norm_name in notion_names:
            matched.append({
                'name': excel_contract['name'],
                'excel_value': excel_contract['value'],
                'notion_value': notion_names[norm_name]['value'],
            })
        else:
            only_in_excel.append(excel_contract)

    for norm_name, notion_contract in notion_names.items():
        if norm_name not in excel_names:
            only_in_notion.append(notion_contract)

    # Print report
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"Matched contracts:        {len(matched)}")
    print(f"Only in Excel (MISSING):  {len(only_in_excel)}")
    print(f"Only in Notion:           {len(only_in_notion)}")

    # Value analysis
    excel_total = sum(c['value'] for c in excel_contracts)
    notion_total = sum(c['value'] for c in notion_contracts)

    print(f"\nTotal Excel Value:  ${excel_total:,.0f}")
    print(f"Total Notion Value: ${notion_total:,.0f}")
    print(f"Difference:         ${abs(excel_total - notion_total):,.0f}")

    if only_in_excel:
        print("\n" + "=" * 70)
        print("CONTRACTS MISSING FROM NOTION (need to add)")
        print("=" * 70)
        missing_value = 0
        for i, c in enumerate(only_in_excel, 1):
            print(f"{i:3}. {c['name'][:45]:<45} ${c['value']:>12,.0f}")
            missing_value += c['value']
        print(f"\n     Missing Value Total: ${missing_value:,.0f}")

    if only_in_notion:
        print("\n" + "=" * 70)
        print("CONTRACTS ONLY IN NOTION (not in Excel)")
        print("=" * 70)
        for i, c in enumerate(only_in_notion, 1):
            print(f"{i:3}. {c['name'][:45]:<45} ${c['value']:>12,.0f}")

    # Value mismatches
    print("\n" + "=" * 70)
    print("VALUE MISMATCHES (>5% difference)")
    print("=" * 70)
    mismatch_count = 0
    for m in matched:
        if m['excel_value'] > 0 and m['notion_value'] > 0:
            diff_pct = abs(m['excel_value'] - m['notion_value']) / max(m['excel_value'], m['notion_value']) * 100
            if diff_pct > 5:
                mismatch_count += 1
                print(f"{m['name'][:40]:<40}")
                print(f"    Excel: ${m['excel_value']:>12,.0f}  |  Notion: ${m['notion_value']:>12,.0f}  |  Diff: {diff_pct:.1f}%")

    if mismatch_count == 0:
        print("No significant value mismatches found.")

    # Return data for further processing
    return {
        'matched': matched,
        'only_in_excel': only_in_excel,
        'only_in_notion': only_in_notion,
    }

if __name__ == '__main__':
    result = reconcile()

    # Save missing contracts to JSON for import
    if result['only_in_excel']:
        with open('/Users/jbb/Downloads/MARS-Contracts/missing_contracts.json', 'w') as f:
            json.dump(result['only_in_excel'], f, indent=2)
        print(f"\n\nSaved {len(result['only_in_excel'])} missing contracts to missing_contracts.json")
