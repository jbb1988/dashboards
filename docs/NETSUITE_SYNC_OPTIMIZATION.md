# NetSuite Sync Optimization Guide

## Problem: Slow Syncs

Original sync took hours because it made **1 API call per record** for line items.
- 2,386 work orders = 2,386+ API calls = hours

## Solution: Batch Everything

### 1. Skip Line Items for Fast Header Sync

```bash
# Fast sync - headers only
curl -X POST "/api/netsuite/sync-work-orders?startDate=2025-01-01&skipLineItems=true"
```

This reduced 2+ hour sync to ~3 minutes.

### 2. Use ONE Query for All Line Items

**BAD (N+1 problem):**
```javascript
for (const wo of workOrders) {
  const lines = await getWorkOrderLines(wo.id); // 1 API call per WO!
}
```

**GOOD (1 query for all):**
```sql
SELECT wo.tranid, tl.*
FROM TransactionLine tl
JOIN Transaction wo ON wo.id = tl.transaction
WHERE wo.type = 'WorkOrd'
  AND wo.trandate >= '2025-01-01'
```

### 3. Pagination: Max 1000 per Request

NetSuite limits each query to 1000 rows. Use offset:

```javascript
const PAGE_SIZE = 1000;
let offset = 0;
let hasMore = true;

while (hasMore && allItems.length < limit) {
  const response = await netsuiteRequest(query, {
    params: { limit: PAGE_SIZE.toString(), offset: offset.toString() }
  });
  allItems = allItems.concat(response.items);
  hasMore = response.hasMore;
  offset += PAGE_SIZE;
}
```

### 4. Use COALESCE for Fallback Values

```sql
-- If Item table doesn't have the name, use BUILTIN.DF as fallback
SELECT
  COALESCE(i.itemid, BUILTIN.DF(tl.item)) AS item_name,
  COALESCE(i.displayname, BUILTIN.DF(tl.item)) AS item_description
FROM TransactionLine tl
LEFT JOIN Item i ON i.id = tl.item
```

### 5. Sync Deltas, Not Everything

Instead of re-syncing all records:
```sql
-- Only get records modified since last sync
WHERE t.lastmodifieddate >= '2025-01-17'
```

## API Endpoints

| Endpoint | Parameter | Effect |
|----------|-----------|--------|
| `/api/netsuite/sync-work-orders` | `skipLineItems=true` | Headers only (fast) |
| `/api/netsuite/sync-sales-orders` | `limit=1000` | Cap records per sync |
| `/api/netsuite/check-2025-2026` | - | Verify completeness |
| `/api/netsuite/data-completeness` | - | Compare DB vs NetSuite |

## Performance Comparison

| Approach | Time | API Calls |
|----------|------|-----------|
| Individual line item fetches | 2+ hours | 2,386+ |
| Headers only (skipLineItems) | ~3 min | 3 |
| Bulk line items query | ~5 min | 1 |

## Sources

- [Oracle NetSuite Performance Tips](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_0825112557.html)
- [Houseblend: High-Volume REST API](https://www.houseblend.io/articles/netsuite-rest-api-high-volume-integrations)
- [NetSuite Concurrency Limits](https://www.katoomi.com/netsuite-integration-concurrency-limits-2025/)
