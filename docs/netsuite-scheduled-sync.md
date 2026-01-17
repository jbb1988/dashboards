# NetSuite Scheduled Sync

## Overview

The NetSuite scheduled sync automatically keeps your local database up to date with the latest work orders and sales orders from NetSuite. This eliminates the need for manual sync operations and ensures the closeout dashboard always shows current data.

## How It Works

### Automatic Daily Sync
- **Schedule**: Runs daily at 2:00 AM UTC
- **Data Range**: Syncs the last 90 days of data
- **What It Syncs**:
  - Work orders with line items
  - Sales orders with line items
  - Updates existing records if they changed in NetSuite

### Configuration

#### Vercel Cron (Recommended for Production)
The sync is configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/netsuite/scheduled-sync",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**Schedule Format**: Standard cron expression
- `0 2 * * *` = Daily at 2:00 AM UTC
- `0 */6 * * *` = Every 6 hours
- `0 8 * * 1` = Every Monday at 8:00 AM UTC

#### Security (Optional)
To prevent unauthorized access to the scheduled sync endpoint, set the `CRON_SECRET` environment variable:

```bash
CRON_SECRET=your-random-secret-here
```

Vercel cron jobs automatically include this in the Authorization header.

### Manual Sync Options

#### 1. Trigger via API
```bash
# With authentication
curl -X POST "https://your-domain.com/api/netsuite/scheduled-sync" \
  -H "Authorization: Bearer your-cron-secret"

# Without authentication (if CRON_SECRET not set)
curl -X POST "https://your-domain.com/api/netsuite/scheduled-sync"
```

#### 2. Sync Specific Date Range
```bash
# Sync work orders for specific dates
curl -X POST "https://your-domain.com/api/netsuite/sync-work-orders?startDate=2026-01-01&endDate=2026-12-31&limit=1000"

# Sync sales orders for specific dates
curl -X POST "https://your-domain.com/api/netsuite/sync-sales-orders?startDate=2026-01-01&endDate=2026-12-31&includeLineItems=true&limit=1000"
```

#### 3. Full Historical Sync
To re-sync all historical data (rarely needed):

```bash
# Sync 2023-2026
for year in 2023 2024 2025 2026; do
  curl -X POST "https://your-domain.com/api/netsuite/sync-work-orders?startDate=${year}-01-01&endDate=${year}-12-31&limit=1000"
  curl -X POST "https://your-domain.com/api/netsuite/sync-sales-orders?startDate=${year}-01-01&endDate=${year}-12-31&includeLineItems=true&limit=1000"
done
```

## Monitoring

### Check Sync Status
```bash
# Get current database counts
curl "https://your-domain.com/api/netsuite/count-synced"
```

**Response:**
```json
{
  "success": true,
  "counts": {
    "workOrders": 3001,
    "workOrderLines": 35336,
    "salesOrders": 3002,
    "salesOrderLines": 4232
  },
  "recentWorkOrders": [...]
}
```

### Vercel Logs
Monitor scheduled sync execution in Vercel dashboard:
1. Go to your project in Vercel
2. Click "Deployments"
3. Click on your production deployment
4. Go to "Functions" tab
5. Look for `/api/netsuite/scheduled-sync`

## Database Tables

The scheduled sync updates these tables:

### Work Orders
- **netsuite_work_orders**: Header data (WO number, date, status, customer, etc.)
- **netsuite_work_order_lines**: Line item details (items, quantities, costs)

### Sales Orders
- **netsuite_sales_orders**: Header data (SO number, date, status, totals)
- **netsuite_sales_order_lines**: Line item details (items, quantities, prices, costs)

## Troubleshooting

### Sync Not Running
1. Verify `vercel.json` is deployed to production
2. Check Vercel project settings → "Cron Jobs" tab
3. Ensure your Vercel plan supports cron jobs (Hobby plans have limits)

### Sync Failing
1. Check Vercel function logs for error messages
2. Verify NetSuite credentials are valid: `NETSUITE_ACCOUNT_ID`, `NETSUITE_CONSUMER_KEY`, etc.
3. Ensure NetSuite integration role has Work Order and Sales Order permissions

### Data Not Updating
1. Verify the sync is running: Check Vercel logs
2. Check for errors in the sync response
3. Manually trigger sync to test: `curl -X POST .../api/netsuite/scheduled-sync`

### Performance Issues
- Default sync window is 90 days - adjust if needed in `scheduled-sync/route.ts`
- Consider breaking large syncs into smaller date ranges
- NetSuite API has rate limits - the sync respects the 1000 record limit per request

## Migration Notes

### From Manual Enrichment
The old enrichment workflow (`/api/closeout/enrich`) is no longer needed. The closeout API now automatically queries the synced NetSuite tables.

**Before:**
1. Load closeout data
2. Manually trigger enrichment
3. Wait for each work order to be fetched from NetSuite

**After:**
1. Load closeout data (enrichment happens automatically via JOIN)
2. Data is already available from daily sync

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/netsuite/scheduled-sync` | GET/POST | Trigger scheduled sync (last 90 days) |
| `/api/netsuite/sync-work-orders` | POST | Sync work orders for date range |
| `/api/netsuite/sync-sales-orders` | POST | Sync sales orders for date range |
| `/api/netsuite/count-synced` | GET | Get current database counts |

## Environment Variables

Required for NetSuite sync:
```bash
NETSUITE_ACCOUNT_ID=your_account_id
NETSUITE_CONSUMER_KEY=your_consumer_key
NETSUITE_CONSUMER_SECRET=your_consumer_secret
NETSUITE_TOKEN_ID=your_token_id
NETSUITE_TOKEN_SECRET=your_token_secret
```

Optional for cron security:
```bash
CRON_SECRET=random-secret-string
```

Optional for production URL:
```bash
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```
