# ABAP — ZCL_EXPENSE_USER_LIST V2
## SAP ECC HCM — Kullanıcı / Org Unit / Pozisyon Listesi (SICF REST Handler)

> Bu sınıf `/sap/bc/masraffco/user_list` SICF servisini handle eder.
> Node.js `SapHcmAdapter` bu endpoint'e POST atar ve aşağıdaki JSON'u bekler.
>
> **Sadece SAP ECC + HCM modülü için geçerlidir.**
> S4 On-Prem → OData V4, S4 Cloud/Rise → SuccessFactors OData kullanır.

---

## DDIC Tipleri (SE11)

### ZMASRAFF_S_USER (Yapı — genişletilmiş)

| Alan | DDIC Tipi | Açıklama |
|------|-----------|----------|
| PERSONNELCODE | PERNR_D | Personel numarası |
| NAME | VORNA | Ad |
| SURNAME | NACHN | Soyad |
| EMAIL | AD_SMTPADR | E-posta adresi |
| DEPARTMENT | ORGTX | Departman uzun adı |
| DEPARTMENT_CODE | ORGEH | Departman kodu (org unit ID) |
| TITLE | STLTX | Unvan / pozisyon adı |
| POSITION_CODE | PLANS | Pozisyon ID |
| MANAGEREMAIL | AD_SMTPADR | Yönetici e-postası |
| UPPER_MANAGER_EMAIL | AD_SMTPADR | Üst yönetici e-postası (skip-level) |
| ISACTIVE | XFELD | 'X' = aktif, '' = pasif |

### ZMASRAFF_T_USER
Table type of ZMASRAFF_S_USER

### ZMASRAFF_S_ORGUNIT (Yeni yapı)

| Alan | DDIC Tipi | Açıklama |
|------|-----------|----------|
| ORGEH | ORGEH | Org unit ID |
| ORGTX | ORGTX | Org unit adı |
| PARENT_ORGEH | ORGEH | Üst org unit ID |
| MANAGER_EMAIL | AD_SMTPADR | Birim yöneticisi e-postası |
| LEVEL | INT4 | Hiyerarşi seviyesi (0=kök) |

### ZMASRAFF_T_ORGUNIT
Table type of ZMASRAFF_S_ORGUNIT

### ZMASRAFF_S_POSITION (Yeni yapı)

| Alan | DDIC Tipi | Açıklama |
|------|-----------|----------|
| PLANS | PLANS | Pozisyon ID |
| PLSTX | PLSTX | Pozisyon adı |
| ORGEH | ORGEH | Bağlı org unit |
| UP_PLANS | PLANS | Üst pozisyon ID |
| LEVEL | INT4 | Hiyerarşi seviyesi |

### ZMASRAFF_T_POSITION
Table type of ZMASRAFF_S_POSITION

---

## ⭐ ZCL_EXPENSE_USER_LIST — V3 (HepsiBiz Proxy — ÖNERİLEN)

> **Senaryo:** SAP HR tabloları (PA0001 vb.) boş.
> Mevcut `MYDMG_GET_USER_LIST` mantığı birebir kullanılır — `/MASRAFF/CFG_01` ve `ZFI_MYDMG_AUTH` tablolarına dayanır.
> HepsiBiz (`https://api.hepsibiz.com/v1/persons/list`) kaynak olur.

```
Node.js SapHcmAdapter
  → SAP SICF /sap/bc/masraffco/user_list  (ZCL_EXPENSE_USER_LIST.handle_request)
    → /MASRAFF/CFG_01 → cfgnm='MYDMG_USER_LIST' → https://api.hepsibiz.com/v1/persons/list
    → ZFI_MYDMG_AUTH TYPE 04 (Basic Auth) + TYPE 05 (Form fields)
    → HepsiBiz'den raw JSON al
  ← {"PERSONS":[...], "ORG_UNITS":[], "POSITIONS":[]}
← DB'ye sync
```

```abap
CLASS zcl_expense_user_list DEFINITION
  PUBLIC FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES if_http_extension.

  PRIVATE SECTION.
    METHODS get_users_json RETURNING VALUE(rv_json) TYPE string.

ENDCLASS.

CLASS zcl_expense_user_list IMPLEMENTATION.

  METHOD if_http_extension~handle_request.
    DATA lv_json TYPE string.
    lv_json = get_users_json( ).
    server->response->set_header_field(
      name  = 'Content-Type'
      value = 'application/json; charset=utf-8' ).
    server->response->set_cdata( lv_json ).
    server->response->set_status( code = 200 reason = 'OK' ).
  ENDMETHOD.

  METHOD get_users_json.
    " MYDMG_GET_USER_LIST mantığını birebir kullanır
    DATA: lv_url         TYPE string,
          lo_http_client TYPE REF TO if_http_client,
          lv_xjson       TYPE xstring,
          lv_raw_json    TYPE string,
          lt_cred        TYPE TABLE OF zfi_mydmg_auth,
          ls_cred        TYPE zfi_mydmg_auth,
          lv_username    TYPE string,
          lv_password    TYPE string.

    " URL: /MASRAFF/CFG_01 tablosundan al
    SELECT SINGLE cfgvl FROM /masraff/cfg_01
      INTO lv_url
      WHERE cfgid = 'URL'
        AND cfgnm = 'MYDMG_USER_LIST'.

    IF sy-subrc NE 0 OR lv_url IS INITIAL.
      rv_json = '{"PERSONS":[],"ORG_UNITS":[],"POSITIONS":[]}'.
      RETURN.
    ENDIF.

    " HTTP client oluştur
    cl_http_client=>create_by_url(
      EXPORTING url    = lv_url
      IMPORTING client = lo_http_client
      EXCEPTIONS argument_not_found = 1
                 plugin_not_active  = 2
                 internal_error     = 3
                 OTHERS             = 4 ).

    IF sy-subrc NE 0.
      rv_json = '{"PERSONS":[],"ORG_UNITS":[],"POSITIONS":[]}'.
      RETURN.
    ENDIF.

    " Credential'ları al (TYPE 04 ve 05 — MYDMG ile aynı)
    SELECT * FROM zfi_mydmg_auth
      INTO TABLE lt_cred
      WHERE type = '04' OR type = '05'.

    lo_http_client->request->set_method( 'POST' ).

    " TYPE 04: HTTP Basic Authentication
    CLEAR ls_cred.
    READ TABLE lt_cred INTO ls_cred WITH KEY type = '04'.
    IF sy-subrc = 0.
      lv_username = ls_cred-username.
      lv_password = ls_cred-password.
      lo_http_client->authenticate(
        username = lv_username
        password = lv_password ).
    ENDIF.

    " TYPE 05: Form field credentials
    CLEAR ls_cred.
    READ TABLE lt_cred INTO ls_cred WITH KEY type = '05'.
    IF sy-subrc = 0.
      lv_username = ls_cred-username.
      lv_password = ls_cred-password.
      lo_http_client->request->set_form_field(
        name  = 'Username'
        value = lv_username ).
      lo_http_client->request->set_form_field(
        name  = 'Password'
        value = lv_password ).
    ENDIF.

    " Header'lar (MYDMG ile aynı)
    lo_http_client->request->set_header_field(
      name = 'content-type' value = 'application/x-www-form-urlencoded' ).
    lo_http_client->request->set_header_field(
      name = 'Charset' value = 'utf-8' ).
    lo_http_client->request->set_header_field(
      name = 'Accept-Charset' value = 'utf-8' ).
    lo_http_client->request->set_header_field(
      name = 'Accept' value = 'application/json' ).

    " Gönder ve al
    CALL METHOD lo_http_client->send
      EXCEPTIONS
        http_communication_failure = 1
        OTHERS                     = 2.
    CALL METHOD lo_http_client->receive
      EXCEPTIONS
        http_communication_failure = 1
        OTHERS                     = 2.

    IF sy-subrc NE 0.
      rv_json = '{"PERSONS":[],"ORG_UNITS":[],"POSITIONS":[]}'.
      lo_http_client->close( ).
      RETURN.
    ENDIF.

    " Response'u al
    lo_http_client->response->get_data( RECEIVING data = lv_xjson ).
    lo_http_client->close( ).

    CALL FUNCTION 'ECATT_CONV_XSTRING_TO_STRING'
      EXPORTING
        im_xstring  = lv_xjson
        im_encoding = 'UTF-8'
      IMPORTING
        ex_string   = lv_raw_json.

    " Response formatını belirle ve wrap et:
    " [ ... ]            → array → {"PERSONS":[...],"ORG_UNITS":[],"POSITIONS":[]}
    " {"PERSONS":...}    → zaten doğru format, ORG_UNITS/POSITIONS ekle
    " diğer             → boş response döndür
    DATA: lv_first TYPE c LENGTH 1.
    lv_first = lv_raw_json.   " İlk karakter

    IF lv_first = '['.
      " Array → PERSONS wrapper
      CONCATENATE '{"PERSONS":' lv_raw_json
                  ',"ORG_UNITS":[],"POSITIONS":[]}'
        INTO rv_json.
    ELSEIF lv_raw_json CS '"PERSONS"'.
      " Zaten PERSONS var
      IF NOT lv_raw_json CS '"ORG_UNITS"'.
        " ORG_UNITS eksik — sona ekle
        DATA lv_len TYPE i.
        lv_len = strlen( lv_raw_json ) - 1.
        CONCATENATE lv_raw_json(lv_len)
                    ',"ORG_UNITS":[],"POSITIONS":[]}'
          INTO rv_json.
      ELSE.
        rv_json = lv_raw_json.
      ENDIF.
    ELSE.
      rv_json = '{"PERSONS":[],"ORG_UNITS":[],"POSITIONS":[]}'.
    ENDIF.

  ENDMETHOD.

ENDCLASS.
```

### SICF Aktivasyon
**Transaction:** SICF
**Yol:** `/sap/bc/masraffco/user_list`
**Handler List:** `ZCL_EXPENSE_USER_LIST`
**Logon:** SAP user (Masrafco kullanıcısı)

### Node.js .env Ayarları
```
IDENTITY_PROVIDER=SAP_HCM
SAP_BASE_URL=http://sap-sunucu:8000
SAP_USERNAME=masrafco_user
SAP_PASSWORD=masrafco_pass
SAP_USER_LIST_PATH=/sap/bc/masraffco/user_list
```

---

## ABAP Sınıf — ZCL_EXPENSE_USER_LIST V2 (SAP HR Tabloları — HR modülü aktifse)

> **Senaryo:** SAP HR tabloları (PA0001, PA0002, PA0105, HRP1000, HRP1001) dolu.
> Bu versiyon SAP HR tablarını doğrudan okur.

### PUBLIC SECTION

```abap
CLASS zcl_expense_user_list DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES if_http_extension.

    TYPES:
      BEGIN OF ty_user,
        personnelcode     TYPE pernr_d,
        name              TYPE vorna,
        surname           TYPE nachn,
        email             TYPE ad_smtpadr,
        department        TYPE orgtx,
        department_code   TYPE orgeh,
        title             TYPE stltx,
        position_code     TYPE plans,
        manageremail      TYPE ad_smtpadr,
        upper_manager_email TYPE ad_smtpadr,
        isactive          TYPE xfeld,
      END OF ty_user,
      tt_user TYPE STANDARD TABLE OF ty_user WITH DEFAULT KEY,

      BEGIN OF ty_orgunit,
        orgeh        TYPE orgeh,
        orgtx        TYPE orgtx,
        parent_orgeh TYPE orgeh,
        manager_email TYPE ad_smtpadr,
        level        TYPE i,
      END OF ty_orgunit,
      tt_orgunit TYPE STANDARD TABLE OF ty_orgunit WITH DEFAULT KEY,

      BEGIN OF ty_position,
        plans    TYPE plans,
        plstx    TYPE plstx,
        orgeh    TYPE orgeh,
        up_plans TYPE plans,
        level    TYPE i,
      END OF ty_position,
      tt_position TYPE STANDARD TABLE OF ty_position WITH DEFAULT KEY.

  PRIVATE SECTION.
    METHODS:
      get_persons
        RETURNING VALUE(rt_persons) TYPE tt_user,
      get_org_units
        RETURNING VALUE(rt_orgunits) TYPE tt_orgunit,
      get_positions
        RETURNING VALUE(rt_positions) TYPE tt_position,
      get_email_for_pernr
        IMPORTING iv_pernr TYPE pernr_d
        RETURNING VALUE(rv_email) TYPE ad_smtpadr,
      get_manager_email
        IMPORTING iv_pernr TYPE pernr_d
        RETURNING VALUE(rv_email) TYPE ad_smtpadr,
      serialize_to_json
        IMPORTING
          it_persons   TYPE tt_user
          it_orgunits  TYPE tt_orgunit
          it_positions TYPE tt_position
        RETURNING VALUE(rv_json) TYPE string.

ENDCLASS.
```

### IMPLEMENTATION

```abap
CLASS zcl_expense_user_list IMPLEMENTATION.

  "─────────────────────────────────────────────────────────────────────
  " IF_HTTP_EXTENSION~HANDLE_REQUEST — Ana giriş noktası
  "─────────────────────────────────────────────────────────────────────
  METHOD if_http_extension~handle_request.
    DATA: lv_json TYPE string.

    " Sadece POST kabul et
    IF server->request->get_method( ) <> 'POST' AND
       server->request->get_method( ) <> 'GET'.
      server->response->set_status( code   = 405
                                    reason = 'Method Not Allowed' ).
      RETURN.
    ENDIF.

    " Veri topla
    DATA(lt_persons)   = get_persons( ).
    DATA(lt_orgunits)  = get_org_units( ).
    DATA(lt_positions) = get_positions( ).

    " JSON serialize
    lv_json = serialize_to_json(
      it_persons   = lt_persons
      it_orgunits  = lt_orgunits
      it_positions = lt_positions ).

    " Response
    server->response->set_header_field(
      name  = 'Content-Type'
      value = 'application/json; charset=utf-8' ).
    server->response->set_cdata( lv_json ).
    server->response->set_status( code = 200 reason = 'OK' ).
  ENDMETHOD.

  "─────────────────────────────────────────────────────────────────────
  " GET_PERSONS — Aktif/pasif tüm personel
  " Kaynaklar: PA0001 (org atama), PA0002 (isim), PA0105 (email),
  "            HRP1000 (org/pozisyon adı), PA0001 self-join (üst yönetici)
  "─────────────────────────────────────────────────────────────────────
  METHOD get_persons.
    DATA: lt_pa0001   TYPE STANDARD TABLE OF pa0001,
          lt_pa0002   TYPE STANDARD TABLE OF pa0002,
          ls_user     TYPE ty_user,
          lv_endda    TYPE endda,
          lv_begda    TYPE begda.

    lv_endda = '99991231'.
    lv_begda = sy-datum.

    " Aktif org atamaları — günümüzü kapsayan kayıtlar
    SELECT * FROM pa0001
      INTO TABLE lt_pa0001
      WHERE endda >= lv_begda
        AND begda <= lv_endda
        AND stat2 = '3'.   " 3 = Aktif

    LOOP AT lt_pa0001 INTO DATA(ls_pa0001).
      CLEAR ls_user.

      ls_user-personnelcode   = ls_pa0001-pernr.
      ls_user-department_code = ls_pa0001-orgeh.
      ls_user-position_code   = ls_pa0001-plans.
      ls_user-isactive        = 'X'.

      " İsim — PA0002
      SELECT SINGLE vorna nachn
        FROM pa0002
        INTO (ls_user-name, ls_user-surname)
        WHERE pernr = ls_pa0001-pernr
          AND endda >= lv_begda
          AND begda <= lv_endda.

      " Email — PA0105 USRTY = '0010'
      ls_user-email = get_email_for_pernr( ls_pa0001-pernr ).

      " Departman uzun adı — HRP1000 OTYPE='O'
      SELECT SINGLE stext FROM hrp1000
        INTO ls_user-department
        WHERE otype = 'O'
          AND objid = ls_pa0001-orgeh
          AND istat = '1'
          AND endda >= lv_begda
          AND begda <= lv_endda.

      " Pozisyon unvanı — HRP1000 OTYPE='S'
      SELECT SINGLE stext FROM hrp1000
        INTO ls_user-title
        WHERE otype = 'S'
          AND objid = ls_pa0001-plans
          AND istat = '1'
          AND endda >= lv_begda
          AND begda <= lv_endda.

      " Yönetici emaili
      ls_user-manageremail = get_manager_email( ls_pa0001-pernr ).

      " Üst yönetici emaili (skip-level) — yöneticinin yöneticisi
      IF ls_user-manageremail IS NOT INITIAL.
        " Yöneticinin PERNR'ini bul
        DATA: lv_mgr_pernr TYPE pernr_d.
        SELECT SINGLE pernr FROM pa0105
          INTO lv_mgr_pernr
          WHERE usrty = '0010'
            AND usrid = ls_user-manageremail
            AND endda >= lv_begda.
        IF sy-subrc = 0.
          ls_user-upper_manager_email = get_manager_email( lv_mgr_pernr ).
        ENDIF.
      ENDIF.

      " E-posta olmayan kaydı atla
      IF ls_user-email IS INITIAL.
        CONTINUE.
      ENDIF.

      APPEND ls_user TO rt_persons.
    ENDLOOP.
  ENDMETHOD.

  "─────────────────────────────────────────────────────────────────────
  " GET_EMAIL_FOR_PERNR — PA0105'ten email çek
  "─────────────────────────────────────────────────────────────────────
  METHOD get_email_for_pernr.
    SELECT SINGLE usrid FROM pa0105
      INTO rv_email
      WHERE pernr  = iv_pernr
        AND usrty  = '0010'     " 0010 = Internet e-posta
        AND endda >= sy-datum.
    TRANSLATE rv_email TO LOWER CASE.
  ENDMETHOD.

  "─────────────────────────────────────────────────────────────────────
  " GET_MANAGER_EMAIL — HRP1001 A 002 ilişkisi üzerinden yönetici bul
  " A 002 = "raporlar" (personel → yönetici)
  "─────────────────────────────────────────────────────────────────────
  METHOD get_manager_email.
    DATA: lv_mgr_plans TYPE plans,
          lv_mgr_pernr TYPE pernr_d.

    " Personelin pozisyonunu al
    SELECT SINGLE plans FROM pa0001
      INTO lv_mgr_plans
      WHERE pernr  = iv_pernr
        AND endda >= sy-datum
        AND stat2  = '3'.

    " Pozisyon üzerinden raporlama hiyerarşisi (HRP1001 A 002)
    SELECT SINGLE sobid FROM hrp1001
      INTO lv_mgr_pernr
      WHERE otype  = 'S'         " S = Pozisyon
        AND objid  = lv_mgr_plans
        AND rsign  = 'A'         " A = alt
        AND relat  = '002'       " 002 = raporlama
        AND istat  = '1'
        AND endda >= sy-datum.

    IF sy-subrc = 0.
      rv_email = get_email_for_pernr( lv_mgr_pernr ).
    ENDIF.
  ENDMETHOD.

  "─────────────────────────────────────────────────────────────────────
  " GET_ORG_UNITS — Tüm org unit ağacı
  " HRP1000 OTYPE='O' + HRP1001 üst ilişkisi
  "─────────────────────────────────────────────────────────────────────
  METHOD get_org_units.
    DATA: ls_ou    TYPE ty_orgunit,
          lv_level TYPE i.

    " Tüm aktif org unitler
    SELECT objid stext FROM hrp1000
      INTO TABLE @DATA(lt_orgs)
      WHERE otype = 'O'
        AND istat = '1'
        AND endda >= @sy-datum
        AND begda <= @sy-datum.

    LOOP AT lt_orgs INTO DATA(ls_org).
      CLEAR ls_ou.
      ls_ou-orgeh = ls_org-objid.
      ls_ou-orgtx = ls_org-stext.

      " Üst org unit — HRP1001 B 002
      SELECT SINGLE objid FROM hrp1001
        INTO ls_ou-parent_orgeh
        WHERE otype  = 'O'
          AND sobid  = ls_org-objid
          AND rsign  = 'B'       " B = üst
          AND relat  = '002'
          AND istat  = '1'
          AND endda >= sy-datum.

      " Yönetici email — HRP1001 A 008 (pozisyon → org unit yönetimi)
      DATA: lv_lead_plans TYPE plans.
      SELECT SINGLE sobid FROM hrp1001
        INTO lv_lead_plans
        WHERE otype  = 'O'
          AND objid  = ls_org-objid
          AND rsign  = 'A'
          AND relat  = '012'     " 012 = yönetim (head of unit)
          AND istat  = '1'
          AND endda >= sy-datum.

      IF sy-subrc = 0.
        " Pozisyona atanmış personeli bul
        DATA: lv_head_pernr TYPE pernr_d.
        SELECT SINGLE pernr FROM pa0001
          INTO lv_head_pernr
          WHERE plans = lv_lead_plans
            AND endda >= sy-datum
            AND stat2 = '3'.
        IF sy-subrc = 0.
          ls_ou-manager_email = get_email_for_pernr( lv_head_pernr ).
        ENDIF.
      ENDIF.

      " Level hesaplama (kök = 0)
      lv_level = 0.
      DATA: lv_check_orgeh TYPE orgeh.
      lv_check_orgeh = ls_ou-parent_orgeh.
      WHILE lv_check_orgeh IS NOT INITIAL AND lv_level < 10.
        lv_level = lv_level + 1.
        SELECT SINGLE objid FROM hrp1001
          INTO lv_check_orgeh
          WHERE otype  = 'O'
            AND sobid  = lv_check_orgeh
            AND rsign  = 'B'
            AND relat  = '002'
            AND istat  = '1'
            AND endda >= sy-datum.
        IF sy-subrc <> 0.
          CLEAR lv_check_orgeh.
        ENDIF.
      ENDWHILE.
      ls_ou-level = lv_level.

      APPEND ls_ou TO rt_orgunits.
    ENDLOOP.
  ENDMETHOD.

  "─────────────────────────────────────────────────────────────────────
  " GET_POSITIONS — Tüm pozisyon ağacı
  " HRP1000 OTYPE='S' + HRP1001 üst pozisyon ilişkisi
  "─────────────────────────────────────────────────────────────────────
  METHOD get_positions.
    DATA: ls_pos TYPE ty_position.

    SELECT objid stext FROM hrp1000
      INTO TABLE @DATA(lt_plans)
      WHERE otype = 'S'
        AND istat = '1'
        AND endda >= @sy-datum
        AND begda <= @sy-datum.

    LOOP AT lt_plans INTO DATA(ls_plan).
      CLEAR ls_pos.
      ls_pos-plans = ls_plan-objid.
      ls_pos-plstx = ls_plan-stext.

      " Bağlı org unit — HRP1001 A 003
      SELECT SINGLE objid FROM hrp1001
        INTO ls_pos-orgeh
        WHERE otype  = 'S'
          AND sobid  = ls_plan-objid
          AND rsign  = 'A'
          AND relat  = '003'     " 003 = belongs to org unit
          AND istat  = '1'
          AND endda >= sy-datum.

      " Üst pozisyon — HRP1001 B 002
      SELECT SINGLE objid FROM hrp1001
        INTO ls_pos-up_plans
        WHERE otype  = 'S'
          AND sobid  = ls_plan-objid
          AND rsign  = 'B'
          AND relat  = '002'
          AND istat  = '1'
          AND endda >= sy-datum.

      " Level: org unit seviyesi + 1
      READ TABLE rt_positions TRANSPORTING NO FIELDS
        WITH KEY orgeh = ls_pos-orgeh.
      ls_pos-level = 1. " varsayılan

      APPEND ls_pos TO rt_positions.
    ENDLOOP.
  ENDMETHOD.

  "─────────────────────────────────────────────────────────────────────
  " SERIALIZE_TO_JSON — /ui2/cl_json ile JSON üret
  "─────────────────────────────────────────────────────────────────────
  METHOD serialize_to_json.
    " SAP'ta /ui2/cl_json veya cl_fpm_json_serializer kullanılabilir
    " Alternatif: sxml_string_writer ile manuel serialization

    DATA: lv_persons_json   TYPE string,
          lv_orgunits_json  TYPE string,
          lv_positions_json TYPE string.

    " /ui2/cl_json ile serialize (SAP 7.40+ SP5)
    lv_persons_json   = /ui2/cl_json=>serialize( data        = it_persons
                                                  compress    = abap_true
                                                  name        = 'PERSONS' ).
    lv_orgunits_json  = /ui2/cl_json=>serialize( data        = it_orgunits
                                                  compress    = abap_true
                                                  name        = 'ORG_UNITS' ).
    lv_positions_json = /ui2/cl_json=>serialize( data        = it_positions
                                                  compress    = abap_true
                                                  name        = 'POSITIONS' ).

    " Wrapper object oluştur
    " Format: { "PERSONS": [...], "ORG_UNITS": [...], "POSITIONS": [...] }
    DATA: lv_p TYPE string,
          lv_o TYPE string,
          lv_pos TYPE string.

    " /ui2/cl_json array serialization için tablo doğrudan serialize edilir
    /ui2/cl_json=>serialize(
      EXPORTING data     = it_persons
                compress = abap_true
      RECEIVING r_json   = lv_p ).

    /ui2/cl_json=>serialize(
      EXPORTING data     = it_orgunits
                compress = abap_true
      RECEIVING r_json   = lv_o ).

    /ui2/cl_json=>serialize(
      EXPORTING data     = it_positions
                compress = abap_true
      RECEIVING r_json   = lv_pos ).

    CONCATENATE '{"PERSONS":' lv_p
                ',"ORG_UNITS":' lv_o
                ',"POSITIONS":' lv_pos
                '}'
      INTO rv_json.
  ENDMETHOD.

ENDCLASS.
```

---

## SICF Servis Tanımı

**Transaction:** SICF
**Yol:** `/sap/bc/masraffco/user_list`
**Handler:** `ZCL_EXPENSE_USER_LIST`
**Doğrulama:** Basic Authentication
**HTTP Metod:** POST veya GET

---

## Beklenen JSON Response Örneği

```json
{
  "PERSONS": [
    {
      "PERSONNELCODE": "00012345",
      "NAME": "Ali",
      "SURNAME": "Veli",
      "EMAIL": "ali.veli@firma.com",
      "DEPARTMENT": "Bilgi Teknolojileri",
      "DEPARTMENT_CODE": "50001234",
      "TITLE": "Yazılım Geliştirici",
      "POSITION_CODE": "50000001",
      "MANAGEREMAIL": "manager@firma.com",
      "UPPER_MANAGER_EMAIL": "director@firma.com",
      "ISACTIVE": "X"
    }
  ],
  "ORG_UNITS": [
    {
      "ORGEH": "50001234",
      "ORGTX": "Bilgi Teknolojileri",
      "PARENT_ORGEH": "10000000",
      "MANAGER_EMAIL": "manager@firma.com",
      "LEVEL": 2
    },
    {
      "ORGEH": "10000000",
      "ORGTX": "Genel Müdürlük",
      "PARENT_ORGEH": "",
      "MANAGER_EMAIL": "ceo@firma.com",
      "LEVEL": 0
    }
  ],
  "POSITIONS": [
    {
      "PLANS": "50000001",
      "PLSTX": "Yazılım Geliştirici",
      "ORGEH": "50001234",
      "UP_PLANS": "50000000",
      "LEVEL": 1
    }
  ]
}
```

---

## HRP1001 İlişki Kodları Referansı

| RSIGN | RELAT | Açıklama |
|-------|-------|----------|
| A | 002 | Pozisyon raporlama (alt → üst) |
| B | 002 | Pozisyon raporlama (üst → alt) |
| A | 003 | Pozisyon → Org unit (belongs to) |
| A | 012 | Yönetim görevi (head of unit) |
| B | 012 | Org unit yöneticisi |

---

## Node.js Adapter Uyumluluğu

`SapHcmAdapter` ([apps/backend/src/identity/adapters/sap-hcm.adapter.ts](../apps/backend/src/identity/adapters/sap-hcm.adapter.ts)) zaten bu format için hazır:

- `response.data.PERSONS` → `syncUsers()` ✅
- `response.data.ORG_UNITS` → `syncOrgUnits()` ✅
- `response.data.POSITIONS` → `syncPositions()` ✅

Adapter'da yeni alan eşleştirmeleri:
- `DEPARTMENT_CODE` → `departmentCode` ✅ (`r.DEPARTMENT_CODE || r.ORGEH`)
- `POSITION_CODE` → `positionCode` ✅ (`r.PLANS || r.POSITION_CODE`)
- `UPPER_MANAGER_EMAIL` → adapter'a eklenmesi gerekiyor (aşağıya bakın)
