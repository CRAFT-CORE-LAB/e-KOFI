class AuthUser {
  const AuthUser({
    required this.id,
    required this.email,
    required this.name,
    required this.role,
  });

  final String id;
  final String email;
  final String name;
  final String role;

  bool get isAdmin => role == 'ADMIN';
  bool get isCanteen => role == 'CASHIER';

  factory AuthUser.fromJson(Map<String, dynamic> json) => AuthUser(
    id: json['id'] as String,
    email: json['email'] as String,
    name: json['name'] as String,
    role: json['role'] as String,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'email': email,
    'name': name,
    'role': role,
  };
}

class SchoolClass {
  const SchoolClass({required this.id, required this.name, required this.schoolId});

  final String id;
  final String name;
  final String schoolId;

  factory SchoolClass.fromJson(Map<String, dynamic> json) => SchoolClass(
    id: json['id'] as String,
    name: json['name'] as String,
    schoolId: json['schoolId'] as String? ?? '',
  );
}

class School {
  const School({required this.id, required this.name, required this.classes});

  final String id;
  final String name;
  final List<SchoolClass> classes;

  factory School.fromJson(Map<String, dynamic> json) => School(
    id: json['id'] as String,
    name: json['name'] as String,
    classes: (json['classes'] as List<dynamic>? ?? [])
        .map((e) => SchoolClass.fromJson(e as Map<String, dynamic>))
        .toList(),
  );
}

class WalletSummary {
  const WalletSummary({required this.id, required this.balanceRwf});

  final String id;
  final int balanceRwf;

  factory WalletSummary.fromJson(Map<String, dynamic> json) => WalletSummary(
    id: json['id'] as String,
    balanceRwf: json['balanceRwf'] as int,
  );
}

class NfcCard {
  const NfcCard({
    required this.id,
    required this.cardUid,
    required this.status,
    required this.studentId,
    this.blockedReason,
    this.student,
  });

  final String id;
  final String cardUid;
  final String status;
  final String studentId;
  final String? blockedReason;
  final Student? student;

  bool get isActive => status == 'ACTIVE';

  factory NfcCard.fromJson(Map<String, dynamic> json) => NfcCard(
    id: json['id'] as String,
    cardUid: json['cardUid'] as String,
    status: json['status'] as String,
    studentId: json['studentId'] as String,
    blockedReason: json['blockedReason'] as String?,
    student: json['student'] is Map<String, dynamic>
        ? Student.fromJson(json['student'] as Map<String, dynamic>)
        : null,
  );
}

class Student {
  const Student({
    required this.id,
    required this.studentCode,
    required this.firstName,
    required this.lastName,
    required this.status,
    required this.pinEnabled,
    this.hasPin = false,
    this.school,
    this.schoolClass,
    this.wallet,
    this.cards = const [],
    this.fingerprints = const [],
  });

  final String id;
  final String studentCode;
  final String firstName;
  final String lastName;
  final String status;
  final bool pinEnabled;
  final bool hasPin;
  final School? school;
  final SchoolClass? schoolClass;
  final WalletSummary? wallet;
  final List<NfcCard> cards;
  final List<FingerprintRecord> fingerprints;

  String get fullName => '$firstName $lastName';
  bool get isActive => status == 'ACTIVE';
  bool get hasFingerprint => fingerprints.isNotEmpty;

  factory Student.fromJson(Map<String, dynamic> json) => Student(
    id: json['id'] as String,
    studentCode: json['studentCode'] as String,
    firstName: json['firstName'] as String,
    lastName: json['lastName'] as String,
    status: json['status'] as String? ?? 'ACTIVE',
    pinEnabled: json['pinEnabled'] as bool? ?? false,
    hasPin: json['hasPin'] as bool? ?? false,
    school: json['school'] is Map<String, dynamic>
        ? School.fromJson({
            ...json['school'] as Map<String, dynamic>,
            'classes': (json['school'] as Map<String, dynamic>)['classes'] ?? [],
          })
        : null,
    schoolClass: json['class'] is Map<String, dynamic>
        ? SchoolClass.fromJson(json['class'] as Map<String, dynamic>)
        : null,
    wallet: json['wallet'] is Map<String, dynamic>
        ? WalletSummary.fromJson(json['wallet'] as Map<String, dynamic>)
        : null,
    cards: (json['cards'] as List<dynamic>? ?? [])
        .map((e) => NfcCard.fromJson(e as Map<String, dynamic>))
        .toList(),
    fingerprints: (json['fingerprints'] as List<dynamic>? ?? [])
        .map((e) => FingerprintRecord.fromJson(e as Map<String, dynamic>))
        .toList(),
  );
}

class FingerprintRecord {
  const FingerprintRecord({
    required this.id,
    required this.studentId,
    required this.finger,
    required this.deviceModel,
    this.student,
  });

  final String id;
  final String studentId;
  final String finger;
  final String deviceModel;
  final Student? student;

  String get fingerLabel {
    switch (finger) {
      case 'RIGHT_THUMB':
        return 'Right thumb';
      case 'RIGHT_INDEX':
        return 'Right index';
      case 'LEFT_THUMB':
        return 'Left thumb';
      case 'LEFT_INDEX':
        return 'Left index';
      default:
        return 'Fingerprint';
    }
  }

  factory FingerprintRecord.fromJson(Map<String, dynamic> json) {
    final nested = json['student'];
    final nestedId = nested is Map<String, dynamic> ? nested['id'] as String? : null;
    return FingerprintRecord(
      id: json['id'] as String,
      studentId: json['studentId'] as String? ?? nestedId ?? '',
      finger: json['finger'] as String? ?? 'RIGHT_INDEX',
      deviceModel: json['deviceModel'] as String? ?? 'Live20R',
      student: nested is Map<String, dynamic> ? Student.fromJson(nested) : null,
    );
  }
}

class LedgerEntry {
  const LedgerEntry({
    required this.id,
    required this.accountType,
    required this.side,
    required this.amountRwf,
  });

  final String id;
  final String accountType;
  final String side;
  final int amountRwf;

  factory LedgerEntry.fromJson(Map<String, dynamic> json) => LedgerEntry(
    id: json['id'] as String,
    accountType: json['accountType'] as String,
    side: json['side'] as String,
    amountRwf: json['amountRwf'] as int,
  );
}

class LedgerEvent {
  const LedgerEvent({
    required this.id,
    required this.type,
    required this.status,
    required this.amountRwf,
    required this.createdAt,
    this.description,
    this.student,
    this.canteenName,
    this.entries = const [],
  });

  final String id;
  final String type;
  final String status;
  final int amountRwf;
  final String createdAt;
  final String? description;
  final Student? student;
  final String? canteenName;
  final List<LedgerEntry> entries;

  factory LedgerEvent.fromJson(Map<String, dynamic> json) {
    final studentJson = json['student'];
    return LedgerEvent(
      id: json['id'] as String,
      type: json['type'] as String,
      status: json['status'] as String,
      amountRwf: json['amountRwf'] as int,
      createdAt: json['createdAt'] as String? ?? '',
      description: json['description'] as String?,
      student: studentJson is Map<String, dynamic>
          ? Student.fromJson({
              'id': studentJson['id'] ?? '',
              'studentCode': studentJson['studentCode'] ?? '',
              'firstName': studentJson['firstName'] ?? '',
              'lastName': studentJson['lastName'] ?? '',
              'status': 'ACTIVE',
              'pinEnabled': false,
            })
          : null,
      canteenName: json['canteen'] is Map<String, dynamic>
          ? json['canteen']['name'] as String?
          : null,
      entries: (json['entries'] as List<dynamic>? ?? [])
          .map((e) => LedgerEntry.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class Canteen {
  const Canteen({
    required this.id,
    required this.name,
    required this.isActive,
    this.school,
    this.account,
    this.history = const [],
  });

  final String id;
  final String name;
  final bool isActive;
  final School? school;
  final WalletSummary? account;
  final List<LedgerEvent> history;

  factory Canteen.fromJson(Map<String, dynamic> json) => Canteen(
    id: json['id'] as String,
    name: json['name'] as String,
    isActive: json['isActive'] as bool? ?? true,
    school: json['school'] is Map<String, dynamic>
        ? School.fromJson({
            ...json['school'] as Map<String, dynamic>,
            'classes': (json['school'] as Map<String, dynamic>)['classes'] ?? [],
          })
        : null,
    account: json['account'] is Map<String, dynamic>
        ? WalletSummary.fromJson(json['account'] as Map<String, dynamic>)
        : null,
    history: (json['history'] as List<dynamic>? ?? [])
        .map((e) => LedgerEvent.fromJson(e as Map<String, dynamic>))
        .toList(),
  );
}

class PeriodTotal {
  const PeriodTotal({required this.count, required this.amountRwf});

  final int count;
  final int amountRwf;

  factory PeriodTotal.fromJson(Map<String, dynamic>? json) => PeriodTotal(
    count: json?['count'] as int? ?? 0,
    amountRwf: json?['amountRwf'] as int? ?? 0,
  );
}

class DashboardStats {
  const DashboardStats({
    required this.students,
    required this.activeStudents,
    required this.canteens,
    required this.activeCards,
    this.enrolledFingerprints = 0,
    required this.postedPurchases,
    required this.purchaseVolumeRwf,
    this.canteenBalanceRwf = 0,
    this.hours6 = const PeriodTotal(count: 0, amountRwf: 0),
    this.hours24 = const PeriodTotal(count: 0, amountRwf: 0),
    this.days7 = const PeriodTotal(count: 0, amountRwf: 0),
    required this.recent,
  });

  final int students;
  final int activeStudents;
  final int canteens;
  final int activeCards;
  final int enrolledFingerprints;
  final int postedPurchases;
  final int purchaseVolumeRwf;
  final int canteenBalanceRwf;
  final PeriodTotal hours6;
  final PeriodTotal hours24;
  final PeriodTotal days7;
  final List<LedgerEvent> recent;

  factory DashboardStats.fromJson(Map<String, dynamic> json) {
    final periods = json['periods'] is Map<String, dynamic> ? json['periods'] as Map<String, dynamic> : null;
    return DashboardStats(
      students: json['students'] as int? ?? 0,
      activeStudents: json['activeStudents'] as int? ?? 0,
      canteens: json['canteens'] as int? ?? 0,
      activeCards: json['activeCards'] as int? ?? 0,
      enrolledFingerprints: json['enrolledFingerprints'] as int? ?? json['activeCards'] as int? ?? 0,
      postedPurchases: json['postedPurchases'] as int? ?? 0,
      purchaseVolumeRwf: json['purchaseVolumeRwf'] as int? ?? 0,
      canteenBalanceRwf: json['canteenBalanceRwf'] as int? ?? 0,
      hours6: PeriodTotal.fromJson(periods?['hours6'] as Map<String, dynamic>?),
      hours24: PeriodTotal.fromJson(periods?['hours24'] as Map<String, dynamic>?),
      days7: PeriodTotal.fromJson(periods?['days7'] as Map<String, dynamic>?),
      recent: (json['recent'] as List<dynamic>? ?? [])
          .map((e) => LedgerEvent.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class WalletDetail {
  const WalletDetail({
    required this.id,
    required this.balanceRwf,
    required this.student,
    required this.history,
  });

  final String id;
  final int balanceRwf;
  final Student student;
  final List<LedgerEvent> history;

  factory WalletDetail.fromJson(Map<String, dynamic> json) => WalletDetail(
    id: json['id'] as String,
    balanceRwf: json['balanceRwf'] as int,
    student: Student.fromJson(json['student'] as Map<String, dynamic>),
    history: (json['history'] as List<dynamic>? ?? [])
        .map((e) => LedgerEvent.fromJson(e as Map<String, dynamic>))
        .toList(),
  );
}

class PurchaseResult {
  const PurchaseResult({required this.event, this.wallet, this.duplicate = false});

  final LedgerEvent event;
  final WalletSummary? wallet;
  final bool duplicate;

  factory PurchaseResult.fromJson(Map<String, dynamic> json) => PurchaseResult(
    event: LedgerEvent.fromJson(json['event'] as Map<String, dynamic>),
    wallet: json['wallet'] is Map<String, dynamic>
        ? WalletSummary.fromJson(json['wallet'] as Map<String, dynamic>)
        : null,
    duplicate: json['duplicate'] as bool? ?? false,
  );
}

class CardRegisterResult {
  const CardRegisterResult({
    required this.card,
    required this.authToken,
    required this.writeToCard,
    required this.message,
  });

  final NfcCard card;
  final String authToken;
  final bool writeToCard;
  final String message;

  factory CardRegisterResult.fromJson(Map<String, dynamic> json) =>
      CardRegisterResult(
        card: NfcCard.fromJson(json['card'] as Map<String, dynamic>),
        authToken: json['authToken'] as String,
        writeToCard: json['writeToCard'] as bool? ?? false,
        message: json['message'] as String? ?? '',
      );
}
