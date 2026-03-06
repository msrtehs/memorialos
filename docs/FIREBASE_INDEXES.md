# Firebase Composite Indexes

These are the composite indexes required by current Firestore queries in this project.

## Required

1. Collection: `deceaseds`
   - Fields:
     - `tenantId` - Ascending
     - `createdAt` - Descending
   - Query using it:
     - `where("tenantId", "==", tenantId)` + `orderBy("createdAt", "desc")`

2. Collection: `death_notifications`
   - Fields:
     - `tenantId` - Ascending
     - `createdAt` - Descending
   - Query using it:
     - `where("tenantId", "==", tenantId)` + `orderBy("createdAt", "desc")`

3. Collection: `death_notifications`
   - Fields:
     - `createdBy` - Ascending
     - `createdAt` - Descending
   - Query using it:
     - `where("createdBy", "==", uid)` + `orderBy("createdAt", "desc")`

## Notes

- New SCI modules (`sci_*` collections) currently query with `where("tenantId","==",...)` and sort in memory to avoid extra composite indexes.
- Single-field indexes are managed automatically by Firestore.
