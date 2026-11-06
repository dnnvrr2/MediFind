# Pharmacy stock updates

Open **Pharmacy portal → Inventory → Stock settings**. The branch owner can select Manual updates or CSV imports. All active members of an approved branch can use CSV importing once enabled, matching the existing permission to edit stock. Manual stock corrections remain available with either method. The POS system card displays “Setup required” and opens a Contact admin page. At the user's request, this page currently has a title/back control and a blank body; contact details will be supplied later. Clicking the card does not activate POS syncing. POS and automatic scheduled imports are not implemented.

## CSV workflow

1. Select CSV imports and save the method.
2. Download the stock template. It contains the branch's approved medicine IDs and current inventory. Medicines without inventory have blank stock/price cells that must be filled. A branch without approved medicines receives a header-only template.
3. Upload a UTF-8 `.csv` file, up to 2 MB and 1,000 medicine rows. Comma, semicolon, and tab separators are accepted. Headers must be unique; every row must have the same number of columns.
4. Match columns. Physical stock is required, with either MediFind medicine ID or medicine name. Name matching must identify exactly one approved medicine; strength, form, and unit can disambiguate it. Supplier/POS product IDs are not MediFind medicine IDs. Owners can save matching for later files.
5. Preview every change. Prices, low-stock thresholds, and availability are optional for existing inventory; an initial inventory record needs a price. Stock and threshold values must be whole numbers without thousands separators; prices use a decimal point. Availability accepts standard true/false values. Unmatched or empty optional values preserve existing values.
6. Fix all row errors before confirming. Duplicate medicine rows, unapproved/unknown medicines, invalid values, and physical stock below reserved quantities block the entire import. New medicines must be submitted and approved through the usual workflow.
7. Confirm the preview. Stock counts are **absolute physical quantities including reserved units**, not quantities to add or quantities already excluding reservations. Medicines absent from the file are unchanged. Reserved units are retained. Current availability is physical stock minus reservations, subject to branch/medicine availability.

Upload and preview do not modify inventory. Drafts expire 30 minutes after upload. Changes to stock/reservations/approval between preview and confirmation require a fresh preview. Confirmation is atomic: either every row applies or none do. Repeating confirmation for the same applied upload does not apply stock again. Uploading the same file as a new upload is a new absolute-stock update and must be reviewed again.

The Inventory page shows the selected method, an Import CSV action, and the latest import timestamp. Stock settings shows the five most recent completed imports, including the uploader. Pharmacy activity also records the import. Customer catalog and pharmacy inventory polling refresh every 20 seconds.

CSV imports are manual snapshots. Walk-in sales, deliveries from suppliers, expiry and losses still require a current file or a manual correction. MediFind order reservations and completion deductions continue automatically.

## API

All routes require an authenticated active member of an approved pharmacy. Uploads and previews belong to the uploading account and branch; another member cannot confirm someone else's draft.

- `GET /api/pharmacy/stock/settings/`: method, saved matching, version, permission and recent import metadata.
- `PATCH /api/pharmacy/stock/settings/`: owner-only method/matching change with the current version.
- `GET /api/pharmacy/stock/template/`: authenticated JSON containing a CSV filename/content for web download or native sharing.
- `POST /api/pharmacy/stock/imports/`: multipart `file`; returns a draft ID, column headers and sample values.
- `POST /api/pharmacy/stock/imports/<uuid>/preview/`: JSON `mapping`; validates and stores an immutable-for-that-version inventory plan.
- `POST /api/pharmacy/stock/imports/<uuid>/confirm/`: JSON `version`; applies the latest valid plan with per-inventory version checks.

Install the schema with `python manage.py migrate`. Import raw rows are cleared after completion; expired pending drafts are removed on the next branch upload. Completed preview/history records remain private for audit. Django admin records for stock settings and imports are read-only.
