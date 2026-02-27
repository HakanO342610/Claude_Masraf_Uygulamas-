# SAP ECC Integration -- Employee Expense to FI Document

## 1. Live Scenario Overview

Employee: 90001234\
Company Code: 1000\
Expense Type: Travel\
Gross Amount: 2,450.50 TRY\
VAT: 18% (V1)\
Cost Center: 100200\
G/L Account: 770001\
Vendor (Employee): 100045\
Document Type: KR

------------------------------------------------------------------------

## 2. Accounting Logic

  Account                  Debit      Credit
  ------------------------ ---------- ----------
  770001 Travel Expense    2,076.69   
  191000 VAT               373.81     
  100045 Employee Vendor              2,450.50

Net: 2,076.69\
VAT: 373.81\
Total: 2,450.50

------------------------------------------------------------------------

## 3. REST Payload (Middleware → SAP)

``` json
{
  "header": {
    "companyCode": "1000",
    "documentDate": "2026-02-20",
    "postingDate": "2026-02-20",
    "documentType": "KR",
    "reference": "EXP-2026-000245",
    "headerText": "Employee Travel Expense",
    "currency": "TRY"
  },
  "items": [
    {
      "type": "GL",
      "glAccount": "770001",
      "amount": 2076.69,
      "debitCredit": "D",
      "costCenter": "100200",
      "taxCode": "V1"
    },
    {
      "type": "TAX",
      "glAccount": "191000",
      "amount": 373.81,
      "debitCredit": "D",
      "taxCode": "V1"
    },
    {
      "type": "VENDOR",
      "vendor": "100045",
      "amount": 2450.50,
      "debitCredit": "C"
    }
  ]
}
```

------------------------------------------------------------------------

## 4. BAPI Mapping (ECC)

### DOCUMENTHEADER

-   COMP_CODE = 1000
-   DOC_DATE = 20.02.2026
-   PSTNG_DATE = 20.02.2026
-   DOC_TYPE = KR
-   REF_DOC_NO = EXP-2026-000245
-   HEADER_TXT = Employee Travel Expense

### ACCOUNTGL

-   770001 / Cost Center 100200 / Tax V1
-   191000 / Tax V1

### ACCOUNTPAYABLE

-   Vendor 100045

### CURRENCYAMOUNT

-   2076.69 Debit
-   373.81 Debit
-   2450.50 Credit

------------------------------------------------------------------------

## 5. SAP FI Table-Level Result

### BKPF (Header)

-   BUKRS: 1000
-   BELNR: 5100002456
-   GJAHR: 2026
-   BLART: KR
-   BLDAT: 20.02.2026
-   BUDAT: 20.02.2026
-   XBLNR: EXP-2026-000245

### BSEG (Line Items)

  BUZEI   HKONT    SHKZG   DMBTR     KOSTL    LIFNR
  ------- -------- ------- --------- -------- --------
  001     770001   S       2076.69   100200   
  002     191000   S       373.81             
  003              H       2450.50            100045

S = Debit\
H = Credit

------------------------------------------------------------------------

## 6. Enterprise Event-Driven Architecture (ECC Compatible)

Expense App\
→ API Gateway\
→ Expense Service\
→ Event Bus (Kafka / RabbitMQ)\
→ SAP Posting Worker\
→ SAP Gateway OData Wrapper\
→ BAPI_ACC_DOCUMENT_POST

### Event Example

``` json
{
  "eventType": "ExpenseApproved",
  "expenseId": "EXP-2026-000245",
  "timestamp": "2026-02-20T10:12:00Z"
}
```

------------------------------------------------------------------------

## 7. ECC REST Exposure Strategy

ECC does not natively expose REST.

Recommended approach:

-   Create custom SAP Gateway OData service (Z_EXPENSE_POST_SRV)
-   CREATE_ENTITY method
-   Call BAPI_ACC_DOCUMENT_POST internally
-   Execute COMMIT WORK
-   Return structured response

------------------------------------------------------------------------

## 8. Transaction & Reliability Controls

-   Idempotency key required
-   Retry policy (max 3 attempts)
-   Dead-letter queue
-   SAP RETURN message mapping
-   Manual reprocess capability

------------------------------------------------------------------------

## 9. Master Data Synchronization

Cache locally: - Cost Centers - GL Accounts - Vendors - Tax Codes

Pull via OData periodically.

------------------------------------------------------------------------

## 10. ECC Compliance Summary

-   REST-based integration via SAP Gateway
-   BAPI wrapper architecture
-   BKPF/BSEG verification
-   Async & scalable
-   Duplicate-safe
-   Enterprise-ready

------------------------------------------------------------------------

END OF DOCUMENT
