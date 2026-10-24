import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:ekofi_mobile/api/api_client.dart';
import 'package:ekofi_mobile/main.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('login screen is shown when there is no session', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(EkofiApp(api: ApiClient()));
    await tester.pump();
    await tester.pump();
    expect(find.text('Welcome'), findsOneWidget);
    expect(find.text('Sign in'), findsOneWidget);
  });
}
