import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import '../models/expense.dart';
import '../services/api_service.dart';

class ExpenseFormScreen extends StatefulWidget {
  const ExpenseFormScreen({super.key});

  @override
  State<ExpenseFormScreen> createState() => _ExpenseFormScreenState();
}

class _ExpenseFormScreenState extends State<ExpenseFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final ApiService _api = ApiService();

  late TextEditingController _amountController;
  late TextEditingController _taxAmountController;
  late TextEditingController _costCenterController;
  late TextEditingController _projectCodeController;
  late TextEditingController _descriptionController;
  late TextEditingController _receiptNumberController;

  DateTime _selectedDate = DateTime.now();
  String _selectedCurrency = 'TRY';
  String _selectedCategory = 'Other';
  bool _saving = false;
  bool _isEditing = false;
  Expense? _existingExpense;

  final ImagePicker _picker = ImagePicker();
  String? _uploadedReceiptId;
  bool _isUploading = false;
  String? _ocrMessage;

  // SAP retry/debug state
  bool _sapRetrying = false;
  String? _sapRetryResult;
  bool _sapDebugging = false;
  Map<String, dynamic>? _sapDebugResult;

  late List<String> _availableCategories;

  @override
  void initState() {
    super.initState();
    _amountController = TextEditingController();
    _taxAmountController = TextEditingController();
    _costCenterController = TextEditingController();
    _projectCodeController = TextEditingController();
    _descriptionController = TextEditingController();
    _receiptNumberController = TextEditingController();
    _availableCategories = List.from(Expense.categories);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final args = ModalRoute.of(context)?.settings.arguments;
    if (args is Expense && !_isEditing) {
      _isEditing = true;
      _existingExpense = args;
      _selectedDate = args.expenseDate;
      _amountController.text = args.amount.toStringAsFixed(2);
      if (args.taxAmount != null && args.taxAmount! > 0) {
        _taxAmountController.text = args.taxAmount!.toStringAsFixed(2);
      }
      _selectedCurrency = args.currency;
      _selectedCategory = args.category;
      _costCenterController.text = args.costCenter;
      _projectCodeController.text = args.projectCode;
      _descriptionController.text = args.description;
      _receiptNumberController.text = args.receiptNumber ?? '';

      if (!_availableCategories.contains(args.category)) {
        _availableCategories.add(args.category);
      }
    }
  }

  @override
  void dispose() {
    _amountController.dispose();
    _taxAmountController.dispose();
    _costCenterController.dispose();
    _projectCodeController.dispose();
    _descriptionController.dispose();
    _receiptNumberController.dispose();
    super.dispose();
  }

  Future<void> _selectDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 30)),
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
    }
  }

  Future<void> _pickReceipt(ImageSource source) async {
    final XFile? image = await _picker.pickImage(
      source: source,
      maxWidth: 2000,
      maxHeight: 2000,
      imageQuality: 85,
    );
    if (image == null) return;

    setState(() {
      _isUploading = true;
      _ocrMessage = null;
    });

    final l10n = AppLocalizations.of(context);
    try {
      final res = await _api.uploadReceipt(image);

      setState(() {
        _uploadedReceiptId = res['id'];

        if (res.containsKey('ocrData') && res['ocrData'] != null) {
          int fieldsUpdated = 0;
          final ocr = res['ocrData'];

          if (ocr['extractedAmount'] != null) {
            _amountController.text = ocr['extractedAmount'].toString();
            fieldsUpdated++;
          }
          if (ocr['extractedTaxAmount'] != null) {
            _taxAmountController.text = ocr['extractedTaxAmount'].toString();
            fieldsUpdated++;
          }
          if (ocr['extractedDate'] != null) {
            final parsedDate = DateTime.tryParse(ocr['extractedDate']);
            if (parsedDate != null) {
              _selectedDate = parsedDate;
              fieldsUpdated++;
            }
          }
          if (ocr['extractedVendor'] != null) {
            _descriptionController.text =
                'Expense at ${ocr['extractedVendor']}';
            fieldsUpdated++;
          }
          if (ocr['extractedCategory'] != null &&
              _availableCategories.contains(ocr['extractedCategory'])) {
            _selectedCategory = ocr['extractedCategory'];
            fieldsUpdated++;
          }
          if (ocr['currency'] != null &&
              Expense.currencies.contains(ocr['currency'])) {
            _selectedCurrency = ocr['currency'];
            fieldsUpdated++;
          }
          if (ocr['receiptNumber'] != null &&
              ocr['receiptNumber'].toString().isNotEmpty) {
            _receiptNumberController.text = ocr['receiptNumber'].toString();
            fieldsUpdated++;
          }

          if (fieldsUpdated > 0) {
            _ocrMessage = 'Auto-filled $fieldsUpdated fields from receipt!';
          } else {
            _ocrMessage = l10n?.receiptProcessing ?? 'Receipt uploaded.';
          }
        } else {
          _ocrMessage =
              l10n?.receiptProcessing ?? 'Receipt uploaded successfully.';
        }
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text(
                  l10n?.receiptProcessing ?? 'Receipt processing complete')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${l10n?.uploadFailed ?? 'Upload failed'}: $e'),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isUploading = false);
    }
  }

  Map<String, dynamic> _buildExpenseData() {
    return {
      'expenseDate': _selectedDate.toIso8601String(),
      'amount': double.parse(_amountController.text),
      if (_taxAmountController.text.isNotEmpty)
        'taxAmount': double.parse(_taxAmountController.text),
      'currency': _selectedCurrency,
      'category': _selectedCategory,
      'costCenter': _costCenterController.text.trim(),
      'projectCode': _projectCodeController.text.trim(),
      'description': _descriptionController.text.trim(),
      'receiptNumber': _receiptNumberController.text.trim(),
    };
  }

  Future<void> _saveDraft() async {
    if (!_formKey.currentState!.validate()) return;
    await _checkDuplicateAndSave(submit: false);
  }

  Future<void> _submitExpense() async {
    if (!_formKey.currentState!.validate()) return;
    await _checkDuplicateAndSave(submit: true);
  }

  Future<void> _checkDuplicateAndSave({required bool submit}) async {
    // Çift tıklama veya eş zamanlı kayıt girişimini engelle
    if (_saving) return;
    setState(() => _saving = true);

    if (_existingExpense == null) {
      // Fiş/Fatura no zorunlu — client-side mükerrer kontrol
      final receiptNo = _receiptNumberController.text.trim();
      try {
        final existing = await _api.getExpenses(limit: 200);
        final isDuplicate = existing.any((e) =>
            e.receiptNumber != null &&
            e.receiptNumber!.toUpperCase() == receiptNo.toUpperCase());

        if (isDuplicate && mounted) {
          await _showDuplicateDialog();
          if (mounted) setState(() => _saving = false);
          return;
        }
      } catch (_) {
        // Ağ hatası → backend kontrolüne bırak, devam et
      }
    }
    await _save(submit: submit);
  }

  Future<void> _showDuplicateDialog() async {
    final l10n = AppLocalizations.of(context);
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        icon: const Icon(Icons.block, color: Colors.red, size: 48),
        title: Text(l10n?.duplicateWarning ?? 'Mükerrer Masraf'),
        content: Text(l10n?.duplicateMessage ??
            'Aynı tarih, tutar ve kategoride zaten bir masraf mevcut.\n\nKayıt engellendi.'),
        actions: [
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(),
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Tamam'),
          ),
        ],
      ),
    );
  }

  Future<void> _save({required bool submit}) async {
    setState(() => _saving = true);
    final l10n = AppLocalizations.of(context);

    try {
      final data = _buildExpenseData();
      Expense expense;

      if (_existingExpense != null) {
        expense = await _api.updateExpense(_existingExpense!.id, data);
      } else {
        expense = await _api.createExpense(data);
      }

      if (submit) {
        await _api.submitExpense(expense.id);
      }

      if (_uploadedReceiptId != null) {
        try {
          await _api.attachReceiptToExpense(_uploadedReceiptId!, expense.id);
        } catch (_) {}
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(submit
                ? (l10n?.expenseSubmitted ?? 'Expense submitted successfully')
                : (l10n?.expenseSavedDraft ?? 'Expense saved as draft')),
            behavior: SnackBarBehavior.floating,
          ),
        );
        Navigator.of(context).pop(true);
      }
    } on ApiException catch (e) {
      if (mounted) {
        // Backend mükerrer hatası → dialog göster
        if (e.message.toLowerCase().contains('mükerrer') ||
            e.message.toLowerCase().contains('mükerer') ||
            e.message.contains('zaten bir masraf')) {
          await _showDuplicateDialog();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(e.message),
              backgroundColor: Theme.of(context).colorScheme.error,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to save expense. Please try again.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }

    if (mounted) setState(() => _saving = false);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final isViewOnly = _existingExpense != null && _existingExpense!.isApproved;

    return Scaffold(
      appBar: AppBar(
        title: Text(_existingExpense != null
            ? (l10n?.editExpense ?? 'Edit Expense')
            : (l10n?.newExpense ?? 'New Expense')),
        actions: [
          if (_existingExpense != null && _existingExpense!.isDraft)
            IconButton(
              icon: const Icon(Icons.delete_outline),
              onPressed: _confirmDelete,
            ),
        ],
      ),
      // Save / Submit butonları sayfanın altına sabitlendi
      bottomNavigationBar: isViewOnly
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _saving ? null : _saveDraft,
                        icon: const Icon(Icons.save_outlined),
                        label: Text(l10n?.saveDraft ?? 'Save Draft'),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: _saving ? null : _submitExpense,
                        icon: _saving
                            ? const SizedBox(
                                height: 18,
                                width: 18,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2, color: Colors.white),
                              )
                            : const Icon(Icons.send),
                        label: Text(l10n?.submitExpense ?? 'Submit'),
                        style: FilledButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
      body: Form(
        key: _formKey,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            // OCR / Receipt Section
            if (!isViewOnly && _existingExpense == null) ...[
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        l10n?.uploadReceipt ?? 'Upload Receipt',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      if (_ocrMessage != null)
                        Container(
                          padding: const EdgeInsets.all(8),
                          margin: const EdgeInsets.only(bottom: 12),
                          decoration: BoxDecoration(
                            color:
                                Theme.of(context).colorScheme.primaryContainer,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            _ocrMessage!,
                            style: TextStyle(
                              color: Theme.of(context)
                                  .colorScheme
                                  .onPrimaryContainer,
                            ),
                          ),
                        ),
                      _isUploading
                          ? const Center(child: CircularProgressIndicator())
                          : Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton.icon(
                                    onPressed: () =>
                                        _pickReceipt(ImageSource.camera),
                                    icon: const Icon(Icons.camera_alt),
                                    label: Text(l10n?.camera ?? 'Camera'),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: OutlinedButton.icon(
                                    onPressed: () =>
                                        _pickReceipt(ImageSource.gallery),
                                    icon: const Icon(Icons.photo_library),
                                    label: Text(l10n?.gallery ?? 'Gallery'),
                                  ),
                                ),
                              ],
                            ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],

            // Fiş / Fatura No — zorunlu, en üstte (Date'den önce)
            TextFormField(
              controller: _receiptNumberController,
              readOnly: isViewOnly || _isEditing,
              textCapitalization: TextCapitalization.characters,
              decoration: InputDecoration(
                labelText: 'Fiş / Fatura No *',
                hintText: 'örn. 0001234567',
                prefixIcon: const Icon(Icons.receipt_outlined),
                helperText: _isEditing
                    ? 'Fiş/fatura numarası değiştirilemez'
                    : 'Zorunlu — aynı fiş/fatura no iki kez kaydedilemez',
              ),
              validator: (value) {
                if (!_isEditing && (value == null || value.trim().isEmpty)) {
                  return 'Fiş/fatura numarası zorunludur';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),

            // Date picker
            Card(
              child: ListTile(
                leading: const Icon(Icons.calendar_today),
                title: Text(l10n?.expenseDate ?? 'Expense Date'),
                subtitle: Text(
                    DateFormat('EEEE, MMMM d, yyyy').format(_selectedDate)),
                trailing: isViewOnly ? null : const Icon(Icons.chevron_right),
                onTap: isViewOnly ? null : _selectDate,
              ),
            ),
            const SizedBox(height: 16),

            // Amount and Currency
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 2,
                  child: TextFormField(
                    controller: _amountController,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(
                          RegExp(r'^\d+\.?\d{0,2}')),
                    ],
                    readOnly: isViewOnly,
                    decoration: InputDecoration(
                      labelText: l10n?.amount ?? 'Amount',
                      hintText: '0.00',
                      prefixIcon: const Icon(Icons.attach_money),
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) return 'Required';
                      final amount = double.tryParse(value);
                      if (amount == null || amount <= 0)
                        return 'Enter a valid amount';
                      return null;
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 1,
                  child: DropdownButtonFormField<String>(
                    value: _selectedCurrency,
                    decoration: InputDecoration(
                        labelText: l10n?.currency ?? 'Currency'),
                    items: Expense.currencies.map((currency) {
                      return DropdownMenuItem(
                          value: currency, child: Text(currency));
                    }).toList(),
                    onChanged: isViewOnly
                        ? null
                        : (value) {
                            if (value != null)
                              setState(() => _selectedCurrency = value);
                          },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // KDV and Category
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 1,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      TextFormField(
                        controller: _taxAmountController,
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true),
                        inputFormatters: [
                          FilteringTextInputFormatter.allow(
                              RegExp(r'^\d+\.?\d{0,2}')),
                        ],
                        readOnly: isViewOnly,
                        decoration: InputDecoration(
                          labelText: l10n?.kdvVat ?? 'KDV (%20)',
                          hintText: '0.00',
                          helperText: '%20 İndirilecek KDV',
                        ),
                        onChanged: (_) => setState(() {}),
                        validator: (value) {
                          if (value != null && value.isNotEmpty) {
                            if (double.tryParse(value) == null)
                              return 'Geçersiz';
                          }
                          return null;
                        },
                      ),
                      if (!isViewOnly) ...[
                        const SizedBox(height: 4),
                        GestureDetector(
                          onTap: () {
                            final net = double.tryParse(_amountController.text);
                            if (net != null && net > 0) {
                              setState(() {
                                _taxAmountController.text =
                                    (net * 0.20).toStringAsFixed(2);
                              });
                            }
                          },
                          child: Text(
                            '%20 Hesapla',
                            style: TextStyle(
                              fontSize: 12,
                              color: Theme.of(context).colorScheme.primary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                      // Matrah + KDV = Brüt özeti
                      Builder(builder: (_) {
                        final net = double.tryParse(_amountController.text);
                        final kdv = double.tryParse(_taxAmountController.text);
                        if (net != null && kdv != null && net > 0 && kdv >= 0) {
                          return Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              'Brüt: ${(net + kdv).toStringAsFixed(2)}',
                              style: TextStyle(
                                fontSize: 11,
                                color: Theme.of(context).colorScheme.primary,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          );
                        }
                        return const SizedBox.shrink();
                      }),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: DropdownButtonFormField<String>(
                    value: _selectedCategory,
                    decoration: InputDecoration(
                      labelText: l10n?.category ?? 'Category',
                      prefixIcon: const Icon(Icons.category_outlined),
                    ),
                    items: _availableCategories.map((category) {
                      return DropdownMenuItem(
                          value: category, child: Text(category));
                    }).toList(),
                    onChanged: isViewOnly
                        ? null
                        : (value) {
                            if (value != null)
                              setState(() => _selectedCategory = value);
                          },
                    validator: (value) {
                      if (value == null || value.isEmpty)
                        return 'Please select a category';
                      return null;
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Cost Center (zorunlu degil)
            TextFormField(
              controller: _costCenterController,
              readOnly: isViewOnly,
              textCapitalization: TextCapitalization.characters,
              decoration: InputDecoration(
                labelText:
                    '${l10n?.costCenter ?? 'Cost Center'} (${l10n?.optional ?? 'optional'})',
                hintText: 'e.g. CC-1001',
                prefixIcon: const Icon(Icons.business_outlined),
              ),
            ),
            const SizedBox(height: 16),

            // Project Code (zorunlu degil)
            TextFormField(
              controller: _projectCodeController,
              readOnly: isViewOnly,
              textCapitalization: TextCapitalization.characters,
              decoration: InputDecoration(
                labelText:
                    '${l10n?.projectCode ?? 'Project Code'} (${l10n?.optional ?? 'optional'})',
                hintText: 'e.g. PRJ-2024-001',
                prefixIcon: const Icon(Icons.folder_outlined),
              ),
            ),
            const SizedBox(height: 16),

            // Description
            TextFormField(
              controller: _descriptionController,
              readOnly: isViewOnly,
              maxLines: 3,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(
                labelText: l10n?.description ?? 'Description',
                hintText: 'Describe the expense...',
                prefixIcon: const Icon(Icons.description_outlined),
                alignLabelWithHint: true,
              ),
              validator: (value) {
                if (value == null || value.trim().isEmpty)
                  return 'Please enter a description';
                return null;
              },
            ),
            const SizedBox(height: 16),

            // SAP Posting Panel — sadece view modunda ve SAP durumu mevcutsa
            if (isViewOnly) _buildSapPanel(context, l10n),

            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  // ==================== SAP Panel ====================

  Widget _buildSapPanel(BuildContext context, AppLocalizations? l10n) {
    final expense = _existingExpense;
    if (expense == null) return const SizedBox.shrink();

    final sapStatus = expense.sapStatus;

    // SAP Document Number (eski davranış — sapStatus yoksa fallback)
    if (sapStatus == null || sapStatus == 'NOT_APPLICABLE') {
      if (expense.sapDocumentNumber != null &&
          expense.sapDocumentNumber!.isNotEmpty) {
        return Card(
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          child: ListTile(
            leading: const Icon(Icons.numbers),
            title: Text(l10n?.sapDocNumber ?? 'SAP Document Number'),
            subtitle: Text(expense.sapDocumentNumber!),
          ),
        );
      }
      return const SizedBox.shrink();
    }

    // SAP OK
    if (sapStatus == 'OK') {
      return Card(
        color: Colors.teal.shade50,
        shape: RoundedRectangleBorder(
          side: BorderSide(color: Colors.teal.shade300),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.check_circle,
                      color: Colors.teal.shade700, size: 24),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      l10n?.sapPostingPanel ?? 'SAP Posting',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: Colors.teal.shade800,
                          ),
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.teal.shade100,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      l10n?.sapOk ?? 'SAP OK',
                      style: TextStyle(
                        color: Colors.teal.shade800,
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ),
              if (expense.sapDocumentNumber != null) ...[
                const SizedBox(height: 12),
                Row(
                  children: [
                    Icon(Icons.numbers, size: 16, color: Colors.teal.shade600),
                    const SizedBox(width: 6),
                    Text(
                      '${l10n?.sapDocNumber ?? 'SAP Doc'}: ${expense.sapDocumentNumber}',
                      style: TextStyle(color: Colors.teal.shade700),
                    ),
                  ],
                ),
              ],
              if (expense.sapPostSuccess != null) ...[
                const SizedBox(height: 8),
                Text(
                  expense.sapPostSuccess!,
                  style: TextStyle(fontSize: 12, color: Colors.teal.shade600),
                ),
              ],
            ],
          ),
        ),
      );
    }

    // SAP FAILED
    if (sapStatus == 'FAILED') {
      return Card(
        color: Colors.red.shade50,
        shape: RoundedRectangleBorder(
          side: BorderSide(color: Colors.red.shade300),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.error, color: Colors.red.shade700, size: 24),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      l10n?.sapPostingPanel ?? 'SAP Posting',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: Colors.red.shade800,
                          ),
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.red.shade100,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      l10n?.sapFailed ?? 'SAP NOK',
                      style: TextStyle(
                        color: Colors.red.shade800,
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ),
              if (expense.sapPostError != null) ...[
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.red.shade100,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    expense.sapPostError!,
                    style: TextStyle(
                      fontSize: 12,
                      fontFamily: 'monospace',
                      color: Colors.red.shade900,
                    ),
                  ),
                ),
              ],
              if (_sapRetryResult != null) ...[
                const SizedBox(height: 8),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.blue.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    _sapRetryResult!,
                    style: TextStyle(fontSize: 12, color: Colors.blue.shade800),
                  ),
                ),
              ],
              if (_sapDebugResult != null) ...[
                const SizedBox(height: 8),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: SelectableText(
                    const JsonEncoder.withIndent('  ').convert(_sapDebugResult),
                    style:
                        const TextStyle(fontSize: 11, fontFamily: 'monospace'),
                  ),
                ),
              ],
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed:
                          _sapRetrying ? null : () => _retrySapPost(l10n),
                      icon: _sapRetrying
                          ? const SizedBox(
                              height: 16,
                              width: 16,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white),
                            )
                          : const Icon(Icons.refresh, size: 18),
                      label: Text(l10n?.sapRetrySend ?? 'SAP Yeniden Gönder'),
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.amber.shade700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton.icon(
                    onPressed: _sapDebugging ? null : () => _debugSapPost(l10n),
                    icon: _sapDebugging
                        ? const SizedBox(
                            height: 16,
                            width: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.bug_report, size: 18),
                    label: Text(l10n?.sapDebugSend ?? 'Debug'),
                  ),
                ],
              ),
            ],
          ),
        ),
      );
    }

    // SAP PENDING
    return Card(
      color: Colors.amber.shade50,
      shape: RoundedRectangleBorder(
        side: BorderSide(color: Colors.amber.shade300),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.schedule, color: Colors.amber.shade700, size: 24),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    l10n?.sapPostingPanel ?? 'SAP Posting',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: Colors.amber.shade800,
                        ),
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.amber.shade100,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    l10n?.sapPending ?? 'SAP Bekliyor',
                    style: TextStyle(
                      color: Colors.amber.shade800,
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: _sapRetrying ? null : () => _retrySapPost(l10n),
              icon: _sapRetrying
                  ? const SizedBox(
                      height: 16,
                      width: 16,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.refresh, size: 18),
              label: Text(l10n?.sapRetrySend ?? 'SAP Yeniden Gönder'),
              style: FilledButton.styleFrom(
                backgroundColor: Colors.amber.shade700,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _retrySapPost(AppLocalizations? l10n) async {
    if (_existingExpense == null) return;
    setState(() {
      _sapRetrying = true;
      _sapRetryResult = null;
    });

    try {
      final result = await _api.retrySapPost(_existingExpense!.id);
      final success = result['sapDocumentNumber'] != null;
      setState(() {
        _sapRetryResult = success
            ? '${l10n?.sapRetrySuccess ?? 'SAP gönderimi başarılı!'} Doc: ${result['sapDocumentNumber']}'
            : l10n?.sapRetryFailed ?? 'SAP gönderimi başarısız.';
      });
      if (success && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(l10n?.sapRetrySuccess ?? 'SAP gönderimi başarılı!'),
            backgroundColor: Colors.teal,
          ),
        );
        // Masraf verisini yenile — SAP paneli güncellensin
        try {
          final refreshed = await _api.getExpense(_existingExpense!.id);
          setState(() => _existingExpense = refreshed);
        } catch (_) {}
      }
    } on ApiException catch (e) {
      // 409 ConflictException = zaten SAP'ta başarıyla gönderilmiş
      if (e.statusCode == 409) {
        setState(() {
          _sapRetryResult =
              l10n?.sapRetrySuccess ?? 'SAP gönderimi zaten başarılı!';
        });
        // Masraf verisini yenile — SAP paneli OK göstersin
        try {
          final refreshed = await _api.getExpense(_existingExpense!.id);
          setState(() => _existingExpense = refreshed);
        } catch (_) {}
      } else {
        setState(() {
          _sapRetryResult = '${l10n?.sapRetryFailed ?? 'Hata'}: ${e.message}';
        });
      }
    } catch (e) {
      setState(() {
        _sapRetryResult = '${l10n?.sapRetryFailed ?? 'Hata'}: $e';
      });
    } finally {
      if (mounted) setState(() => _sapRetrying = false);
    }
  }

  Future<void> _debugSapPost(AppLocalizations? l10n) async {
    if (_existingExpense == null) return;
    setState(() {
      _sapDebugging = true;
      _sapDebugResult = null;
    });

    try {
      final result = await _api.debugSapPost(_existingExpense!.id);
      setState(() => _sapDebugResult = result);
    } catch (e) {
      setState(() {
        _sapDebugResult = {'error': e.toString()};
      });
    } finally {
      if (mounted) setState(() => _sapDebugging = false);
    }
  }

  // ==================== Delete ====================

  Future<void> _confirmDelete() async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n?.deleteExpense ?? 'Delete Expense'),
        content: Text(l10n?.deleteExpenseConfirm ??
            'Are you sure you want to delete this expense?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(l10n?.cancel ?? 'Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
            child: Text(l10n?.delete ?? 'Delete'),
          ),
        ],
      ),
    );

    if (confirmed == true && _existingExpense != null) {
      try {
        await _api.deleteExpense(_existingExpense!.id);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(l10n?.expenseDeleted ?? 'Expense deleted'),
              behavior: SnackBarBehavior.floating,
            ),
          );
          Navigator.of(context).pop(true);
        }
      } on ApiException catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(e.message),
              backgroundColor: Theme.of(context).colorScheme.error,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }
    }
  }
}
