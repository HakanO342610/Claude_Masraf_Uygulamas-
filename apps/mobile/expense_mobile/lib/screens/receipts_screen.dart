import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../services/api_service.dart';

class ReceiptsScreen extends StatefulWidget {
  const ReceiptsScreen({super.key});

  @override
  State<ReceiptsScreen> createState() => _ReceiptsScreenState();
}

class _ReceiptsScreenState extends State<ReceiptsScreen> {
  final ApiService _api = ApiService();
  final ImagePicker _picker = ImagePicker();
  bool _isLoading = true;
  bool _isUploading = false;
  List<Map<String, dynamic>> _receipts = [];

  @override
  void initState() {
    super.initState();
    _loadReceipts();
  }

  Future<void> _loadReceipts() async {
    setState(() => _isLoading = true);
    try {
      _receipts = await _api.getMyReceipts();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load receipts: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _pickAndUpload() async {
    final XFile? image = await _picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 2000,
      maxHeight: 2000,
      imageQuality: 85,
    );
    if (image == null) return;

    setState(() => _isUploading = true);
    try {
      await _api.uploadReceipt(image.path, image.mimeType ?? 'image/jpeg');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Receipt uploaded successfully')),
        );
      }
      await _loadReceipts();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isUploading = false);
    }
  }

  Future<void> _takePhoto() async {
    final XFile? photo = await _picker.pickImage(
      source: ImageSource.camera,
      maxWidth: 2000,
      maxHeight: 2000,
      imageQuality: 85,
    );
    if (photo == null) return;

    setState(() => _isUploading = true);
    try {
      await _api.uploadReceipt(photo.path, photo.mimeType ?? 'image/jpeg');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Receipt uploaded successfully')),
        );
      }
      await _loadReceipts();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isUploading = false);
    }
  }

  String _formatSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  IconData _ocrIcon(String status) {
    switch (status) {
      case 'COMPLETED':
        return Icons.check_circle;
      case 'PROCESSING':
        return Icons.hourglass_empty;
      case 'FAILED':
        return Icons.error;
      default:
        return Icons.pending;
    }
  }

  Color _ocrColor(String status) {
    switch (status) {
      case 'COMPLETED':
        return Colors.green;
      case 'PROCESSING':
        return Colors.blue;
      case 'FAILED':
        return Colors.red;
      default:
        return Colors.amber;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Receipts')),
      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          FloatingActionButton.small(
            heroTag: 'camera',
            onPressed: _isUploading ? null : _takePhoto,
            child: const Icon(Icons.camera_alt),
          ),
          const SizedBox(height: 8),
          FloatingActionButton(
            heroTag: 'gallery',
            onPressed: _isUploading ? null : _pickAndUpload,
            child: _isUploading
                ? const SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.upload_file),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _receipts.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.receipt_long, size: 64, color: Colors.grey[300]),
                      const SizedBox(height: 16),
                      Text(
                        'No receipts yet',
                        style: TextStyle(color: Colors.grey[600]),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Upload a photo of your receipt',
                        style: TextStyle(fontSize: 12, color: Colors.grey[400]),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadReceipts,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _receipts.length,
                    itemBuilder: (context, index) {
                      final receipt = _receipts[index];
                      final ocrStatus = receipt['ocrStatus']?.toString() ?? 'PENDING';
                      final ocrData = receipt['ocrData'] as Map<String, dynamic>?;
                      
                      String? extractedText;
                      if (ocrData != null) {
                        final vendor = ocrData['extractedVendor'];
                        final amount = ocrData['extractedAmount'];
                        final date = ocrData['extractedDate'];
                        final parts = <String>[];
                        if (vendor != null) parts.add(vendor.toString());
                        if (date != null) parts.add(date.toString());
                        if (amount != null) parts.add('${amount.toString()}');
                        if (parts.isNotEmpty) {
                          extractedText = parts.join(' • ');
                        }
                      }

                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          leading: Icon(
                            Icons.description,
                            color: Theme.of(context).colorScheme.primary,
                          ),
                          title: Text(
                            receipt['fileName']?.toString() ?? 'Unknown',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(_formatSize(receipt['fileSize'] as int? ?? 0)),
                                  const SizedBox(width: 8),
                                  Icon(
                                    _ocrIcon(ocrStatus),
                                    size: 14,
                                    color: _ocrColor(ocrStatus),
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    ocrStatus,
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: _ocrColor(ocrStatus),
                                    ),
                                  ),
                                ],
                              ),
                              if (extractedText != null) ...[
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    Icon(Icons.auto_awesome, size: 14, color: Colors.purple[300]),
                                    const SizedBox(width: 4),
                                    Expanded(
                                      child: Text(
                                        extractedText,
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: Colors.purple[700],
                                          fontWeight: FontWeight.w500,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ],
                          ),
                          trailing: receipt['expenseId'] != null
                              ? const Chip(
                                  label: Text('Attached', style: TextStyle(fontSize: 10)),
                                  padding: EdgeInsets.zero,
                                  visualDensity: VisualDensity.compact,
                                )
                              : null,
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
