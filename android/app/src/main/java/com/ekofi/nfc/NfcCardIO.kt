package com.ekofi.nfc

import android.nfc.NdefMessage
import android.nfc.NdefRecord
import android.nfc.Tag
import android.nfc.tech.Ndef
import android.nfc.tech.NdefFormatable
import java.nio.charset.Charset

data class ScannedCard(val uid: String, val authToken: String?)

object NfcCardIO {
    const val TOKEN_PREFIX = "EKOFI:"

    fun uidFrom(tag: Tag): String =
        tag.id.joinToString("") { byte -> "%02X".format(byte) }

    fun readToken(tag: Tag): String? {
        val ndef = Ndef.get(tag) ?: return null
        ndef.connect()
        try {
            val message = ndef.ndefMessage ?: return null
            return message.records
                .mapNotNull { record ->
                    val payload = record.payload
                    if (payload.isEmpty()) return@mapNotNull null
                    val text = decodeText(payload)
                    if (text.startsWith(TOKEN_PREFIX)) text.removePrefix(TOKEN_PREFIX) else null
                }
                .firstOrNull()
        } finally {
            ndef.close()
        }
    }

    fun writeToken(tag: Tag, token: String) {
        val record = NdefRecord.createTextRecord("en", TOKEN_PREFIX + token)
        val message = NdefMessage(arrayOf(record))
        val ndef = Ndef.get(tag)
        if (ndef != null) {
            ndef.connect()
            try {
                if (!ndef.isWritable) {
                    throw IllegalStateException("Tag is not writable")
                }
                if (ndef.maxSize < message.toByteArray().size) {
                    throw IllegalStateException("Tag is too small for the auth token")
                }
                ndef.writeNdefMessage(message)
            } finally {
                ndef.close()
            }
            return
        }
        val formatable = NdefFormatable.get(tag)
            ?: throw IllegalStateException("Tag does not support NDEF")
        formatable.connect()
        try {
            formatable.format(message)
        } finally {
            formatable.close()
        }
    }

    private fun decodeText(payload: ByteArray): String {
        val status = payload[0].toInt()
        val languageLength = status and 0x3F
        val isUtf16 = status and 0x80 != 0
        val charset = if (isUtf16) Charset.forName("UTF-16") else Charsets.UTF_8
        return String(payload, 1 + languageLength, payload.size - 1 - languageLength, charset)
    }
}
