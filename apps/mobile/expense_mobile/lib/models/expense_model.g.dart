// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'expense_model.dart';

// **************************************************************************
// TypeAdapterGenerator
// **************************************************************************

class ExpenseModelAdapter extends TypeAdapter<ExpenseModel> {
  @override
  final int typeId = 0;

  @override
  ExpenseModel read(BinaryReader reader) {
    final numOfFields = reader.readByte();
    final fields = <int, dynamic>{
      for (int i = 0; i < numOfFields; i++) reader.readByte(): reader.read(),
    };
    return ExpenseModel()
      ..id = fields[0] as String
      ..expenseDate = fields[1] as String
      ..amount = fields[2] as double
      ..currency = fields[3] as String
      ..category = fields[4] as String
      ..status = fields[5] as String
      ..costCenter = fields[6] as String
      ..projectCode = fields[7] as String
      ..description = fields[8] as String
      ..sapDocumentNumber = fields[9] as String?;
  }

  @override
  void write(BinaryWriter writer, ExpenseModel obj) {
    writer
      ..writeByte(10)
      ..writeByte(0)
      ..write(obj.id)
      ..writeByte(1)
      ..write(obj.expenseDate)
      ..writeByte(2)
      ..write(obj.amount)
      ..writeByte(3)
      ..write(obj.currency)
      ..writeByte(4)
      ..write(obj.category)
      ..writeByte(5)
      ..write(obj.status)
      ..writeByte(6)
      ..write(obj.costCenter)
      ..writeByte(7)
      ..write(obj.projectCode)
      ..writeByte(8)
      ..write(obj.description)
      ..writeByte(9)
      ..write(obj.sapDocumentNumber);
  }

  @override
  int get hashCode => typeId.hashCode;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ExpenseModelAdapter &&
          runtimeType == other.runtimeType &&
          typeId == other.typeId;
}
