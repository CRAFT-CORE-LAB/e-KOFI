import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:nfc_manager/nfc_manager.dart';
import 'package:nfc_manager/nfc_manager_android.dart';
import 'package:nfc_manager/nfc_manager_ios.dart';
import 'package:nfc_manager/ndef_record.dart';

class ScannedNfcCard {
  const ScannedNfcCard({required this.uid, this.authToken});

  final String uid;
  final String? authToken;
}

class NfcService {
  static const tokenPrefix = 'EKOFI:';

  Future<bool> isEnabled() async {
    try {
      return await NfcManager.instance.checkAvailability() ==
          NfcAvailability.enabled;
    } catch (_) {
      return false;
    }
  }

  Future<ScannedNfcCard> scan({
    String iosMessage = 'Hold an e-KOFI card near the phone',
  }) {
    return _session(
      iosMessage: iosMessage,
      handle: (tag) async {
        return ScannedNfcCard(uid: _uid(tag), authToken: await _readToken(tag));
      },
    );
  }

  Future<void> writeToken(String token) {
    return _session(
      iosMessage: 'Hold the same card near the phone once more',
      handle: (tag) async {
        final message = NdefMessage(records: [_textRecord('$tokenPrefix$token')]);
        final android = NdefAndroid.from(tag);
        if (android != null) {
          if (!android.isWritable) {
            throw Exception('This tag is not writable.');
          }
          await android.writeNdefMessage(message);
          return;
        }
        final formatable = NdefFormatableAndroid.from(tag);
        if (formatable != null) {
          await formatable.format(message);
          return;
        }
        final ios = NdefIos.from(tag);
        if (ios != null) {
          await ios.writeNdef(message);
          return;
        }
        throw Exception('This tag does not support NDEF.');
      },
    );
  }

  Future<T> _session<T>({
    required String iosMessage,
    required Future<T> Function(NfcTag tag) handle,
  }) async {
    if (!await isEnabled()) {
      throw Exception('This phone cannot read cards.');
    }
    final done = Completer<T>();
    await NfcManager.instance.startSession(
      pollingOptions: {
        NfcPollingOption.iso14443,
        NfcPollingOption.iso15693,
      },
      alertMessageIos: iosMessage,
      invalidateAfterFirstReadIos: false,
      onDiscovered: (tag) async {
        if (done.isCompleted) return;
        try {
          final value = await handle(tag);
          await NfcManager.instance.stopSession(alertMessageIos: 'Card captured');
          done.complete(value);
        } catch (error) {
          await NfcManager.instance.stopSession(errorMessageIos: '$error');
          done.completeError(error);
        }
      },
    );
    return done.future.timeout(
      const Duration(seconds: 25),
      onTimeout: () {
        NfcManager.instance.stopSession();
        throw Exception('No card was found. Hold it still against the back of the phone.');
      },
    );
  }

  String _uid(NfcTag tag) {
    final android = NfcTagAndroid.from(tag);
    if (android != null) return _hex(android.id);
    final iso = Iso7816Ios.from(tag);
    if (iso != null) return _hex(iso.identifier);
    final mifare = MiFareIos.from(tag);
    if (mifare != null) return _hex(mifare.identifier);
    throw Exception(
      'Could not read this card. Try again, or use another card.',
    );
  }

  Future<String?> _readToken(NfcTag tag) async {
    NdefMessage? message = NdefAndroid.from(tag)?.cachedNdefMessage;
    message ??= NdefIos.from(tag)?.cachedNdefMessage;
    message ??= await NdefIos.from(tag)?.readNdef();
    if (message == null) return null;
    for (final record in message.records) {
      final text = _decodeText(record);
      if (text != null && text.startsWith(tokenPrefix)) {
        return text.substring(tokenPrefix.length);
      }
    }
    return null;
  }

  NdefRecord _textRecord(String text) {
    final language = utf8.encode('en');
    final body = utf8.encode(text);
    final payload = Uint8List(1 + language.length + body.length);
    payload[0] = language.length;
    payload.setRange(1, 1 + language.length, language);
    payload.setRange(1 + language.length, payload.length, body);
    return NdefRecord(
      typeNameFormat: TypeNameFormat.wellKnown,
      type: Uint8List.fromList([0x54]),
      identifier: Uint8List(0),
      payload: payload,
    );
  }

  String? _decodeText(NdefRecord record) {
    if (record.typeNameFormat != TypeNameFormat.wellKnown) return null;
    if (record.type.isEmpty || record.type.first != 0x54) return null;
    if (record.payload.isEmpty) return null;
    final languageLength = record.payload.first & 0x3F;
    return utf8.decode(record.payload.sublist(1 + languageLength));
  }

  String _hex(Uint8List bytes) =>
      bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join().toUpperCase();
}
