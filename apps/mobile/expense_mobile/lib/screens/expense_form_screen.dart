import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:image_picker/image_picker.dart';
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

  late List<String> _availableCategories;

  @override
  void initState() {
    super.initState();
    _amountController = TextEditingController();
    _taxAmountController = TextEditingController();
    _costCenterController = TextEditingController();
    _projectCodeController = TextEditingController();
    _descriptionController = TextEditingController();
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
            _descriptionController.text = 'Expense at ${ocr['extractedVendor']}';
            fieldsUpdated++;
          }
          if (ocr['extractedCategory'] != null && _availableCategories.contains(ocr['extractedCategory'])) {
            _selectedCategory = ocr['extractedCategory'];
            fieldsUpdated++;
          }
          if (ocr['currency'] != null && Expense.currencies.contains(ocr['currency'])) {
            _selectedCurrency = ocr['currency'];
            fieldsUpdated++;
          }
          
          if (fieldsUpdated > 0) {
            _ocrMessage = 'Auto-filled $fieldsUpdated fields from receipt!';
          } else {
            _ocrMessage = 'Receipt uploaded. Could not extract data automatically.';
          }
        } else {
          _ocrMessage = 'Receipt uploaded successfully.';
        }
      });
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Receipt processing complete')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Upload failed: $e'),
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
      if (_taxAmountController.text.isNotEmpty) 'taxAmount': double.parse(_taxAmountController.text),
      'currency': _selectedCurrency,
      'category': _selectedCategory,
      'costCenter': _costCenterController.text.trim(),
      'projectCode': _projectCodeController.text.trim(),
      'description': _descriptionController.text.trim(),
    };
  }

  Future<void> _saveDraft() async {
    if (!_formKey.currentState!.validate()) return;
    await _save(submit: false);
  }

  Future<void> _submitExpense() async {
    if (!_formKey.currentState!.validate()) return;
    await _save(submit: true);
  }

  Future<void> _save({required bool submit}) async {
    setState(() => _saving = true);

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
        } catch (_) {
          // ignore error if attachment fails
        }
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(submit
                ? 'Expense submitted successfully'
                : 'Expense saved as draft'),
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
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Failed to save expense. Please try again.'),
            backgroundColor: Theme.of(context).colorScheme.error,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }

    if (mounted) setState(() => _saving = false);
  }

  @override
  Widget build(BuildContext context) {
    final isViewOnly = _existingExpense != null &&
        _existingExpense!.isApproved;

    return Scaffold(
      appBar: AppBar(
        title: Text(_existingExpense != null ? 'Edit Expense' : 'New Expense'),
        actions: [
          if (_existingExpense != null && _existingExpense!.isDraft)
            IconButton(
              icon: const Icon(Icons.delete_outline),
              onPressed: () => _confirmDelete(),
            ),
        ],
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
                        'Upload Receipt',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      if (_ocrMessage != null)
                        Container(
                          padding: const EdgeInsets.all(8),
                          margin: const EdgeInsets.only(bottom: 12),
                          decoration: BoxDecoration(
                            color: Theme.of(context).colorScheme.primaryContainer,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            _ocrMessage!,
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.onPrimaryContainer,
                            ),
                          ),
                        ),
                      _isUploading
                          ? const Center(child: CircularProgressIndicator())
                          : Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton.icon(
                                    onPressed: () => _pickReceipt(ImageSource.camera),
                                    icon: const Icon(Icons.camera_alt),
                                    label: const Text('Camera'),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: OutlinedButton.icon(
                                    onPressed: () => _pickReceipt(ImageSource.gallery),
                                    icon: const Icon(Icons.photo_library),
                                    label: const Text('Gallery'),
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

            // Date picker
            Card(
              child: ListTile(
                leading: const Icon(Icons.calendar_today),
                title: const Text('Expense Date'),
                subtitle: Text(
                  DateFormat('EEEE, MMMM d, yyyy').format(_selectedDate),
                ),
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
                    decoration: const InputDecoration(
                      labelText: 'Amount',
                      hintText: '0.00',
                      prefixIcon: Icon(Icons.attach_money),
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Required';
                      }
                      final amount = double.tryParse(value);
                      if (amount == null || amount <= 0) {
                        return 'Enter a valid amount';
                      }
                      return null;
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 1,
                  child: DropdownButtonFormField<String>(
                    value: _selectedCurrency,
                    decoration: const InputDecoration(
                      labelText: 'Currency',
                    ),
                    items: Expense.currencies.map((currency) {
                      return DropdownMenuItem(
                        value: currency,
                        child: Text(currency),
                      );
                    }).toList(),
                    onChanged: isViewOnly
                        ? null
                        : (value) {
                            if (value != null) {
                              setState(() => _selectedCurrency = value);
                            }
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
                  child: TextFormField(
                    controller: _taxAmountController,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(
                          RegExp(r'^\d+\.?\d{0,2}')),
                    ],
                    readOnly: isViewOnly,
                    decoration: const InputDecoration(
                      labelText: 'KDV (VAT)',
                      hintText: '0.00',
                    ),
                    validator: (value) {
                      if (value != null && value.isNotEmpty) {
                        if (double.tryParse(value) == null) {
                          return 'Invalid';
                        }
                      }
                      return null;
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: DropdownButtonFormField<String>(
                    value: _selectedCategory,
                    decoration: const InputDecoration(
                      labelText: 'Category',
                      prefixIcon: Icon(Icons.category_outlined),
                    ),
                    items: _availableCategories.map((category) {
                      return DropdownMenuItem(
                        value: category,
                        child: Text(category),
                      );
                    }).toList(),
                    onChanged: isViewOnly
                        ? null
                        : (value) {
                            if (value != null) {
                              setState(() => _selectedCategory = value);
                            }
                          },
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Please select a category';
                      }
                      return null;
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Cost Center
            TextFormField(
              controller: _costCenterController,
              readOnly: isViewOnly,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(
                labelText: 'Cost Center',
                hintText: 'e.g. CC-1001',
                prefixIcon: Icon(Icons.business_outlined),
              ),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Please enter a cost center';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),

            // Project Code
            TextFormField(
              controller: _projectCodeController,
              readOnly: isViewOnly,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(
                labelText: 'Project Code',
                hintText: 'e.g. PRJ-2024-001',
                prefixIcon: Icon(Icons.folder_outlined),
              ),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Please enter a project code';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),

            // Description
            TextFormField(
              controller: _descriptionController,
              readOnly: isViewOnly,
              maxLines: 3,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                labelText: 'Description',
                hintText: 'Describe the expense...',
                prefixIcon: Icon(Icons.description_outlined),
                alignLabelWithHint: true,
              ),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Please enter a description';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),

            // SAP Document Number (read-only if present)
            if (_existingExpense?.sapDocumentNumber != null &&
                _existingExpense!.sapDocumentNumber!.isNotEmpty)
              Card(
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                child: ListTile(
                  leading: const Icon(Icons.numbers),
                  title: const Text('SAP Document Number'),
                  subtitle: Text(_existingExpense!.sapDocumentNumber!),
                ),
              ),

            const SizedBox(height: 24),

            // Action buttons
            if (!isViewOnly) ...[
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _saving ? null : _saveDraft,
                      icon: const Icon(Icons.save_outlined),
                      label: const Text('Save Draft'),
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
                      label: const Text('Submit'),
                      style: FilledButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmDelete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Expense'),
        content: const Text(
            'Are you sure you want to delete this expense? This action cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed == true && _existingExpense != null) {
      try {
        await _api.deleteExpense(_existingExpense!.id);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Expense deleted'),
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
