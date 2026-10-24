package com.ekofi.nfc

import android.app.PendingIntent
import android.content.Intent
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import kotlin.concurrent.thread

class MainActivity : AppCompatActivity() {
    private var nfcAdapter: NfcAdapter? = null
    private lateinit var api: ApiClient
    private var lastUid: String? = null
    private var lastToken: String? = null
    private var lastTag: Tag? = null
    private var pendingWriteToken: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        nfcAdapter = NfcAdapter.getDefaultAdapter(this)
        val apiUrl = findViewById<EditText>(R.id.apiUrl)
        apiUrl.setText(BuildConfig.API_URL)
        api = ApiClient(BuildConfig.API_URL)

        findViewById<Button>(R.id.loginButton).setOnClickListener {
            api.baseUrl = apiUrl.text.toString()
            val email = findViewById<EditText>(R.id.email).text.toString()
            val password = findViewById<EditText>(R.id.password).text.toString()
            runNetwork("Signing in…") {
                api.login(email, password)
                "Signed in."
            }
        }

        findViewById<Button>(R.id.registerButton).setOnClickListener {
            val uid = lastUid
            if (uid == null) {
                toast("Scan a card first")
                return@setOnClickListener
            }
            val studentId = findViewById<EditText>(R.id.studentId).text.toString()
            runNetwork("Registering card…") {
                val result = api.registerCard(studentId, uid, lastToken)
                val issued = result.optString("authToken")
                if (issued.isNotBlank() && lastToken == null) {
                    pendingWriteToken = issued
                    "Write the new token by tapping the same tag again."
                } else {
                    "Card registered."
                }
            }
        }

        findViewById<Button>(R.id.resolveButton).setOnClickListener {
            val uid = lastUid
            val token = lastToken
            if (uid == null || token == null) {
                toast("Scan a card that already has a secure token")
                return@setOnClickListener
            }
            runNetwork("Resolving card…") {
                val result = api.resolveCard(uid, token)
                val student = result.getJSONObject("student")
                "Student ${student.getString("studentCode")} ${student.getString("lastName")}"
            }
        }

        handleTag(intent)
    }

    override fun onResume() {
        super.onResume()
        val adapter = nfcAdapter ?: return
        val intent = Intent(this, javaClass).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val pending = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        adapter.enableForegroundDispatch(this, pending, null, null)
    }

    override fun onPause() {
        super.onPause()
        nfcAdapter?.disableForegroundDispatch(this)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleTag(intent)
    }

    private fun handleTag(intent: Intent?) {
        val tag = intent?.getParcelableExtra<Tag>(NfcAdapter.EXTRA_TAG) ?: return
        lastTag = tag
        lastUid = NfcCardIO.uidFrom(tag)
        lastToken = runCatching { NfcCardIO.readToken(tag) }.getOrNull()
        findViewById<TextView>(R.id.uidView).text = "UID: $lastUid"
        findViewById<TextView>(R.id.tokenView).text = "Token: ${lastToken ?: "none — will issue on register"}"

        val toWrite = pendingWriteToken
        if (toWrite != null) {
            runCatching { NfcCardIO.writeToken(tag, toWrite) }
                .onSuccess {
                    pendingWriteToken = null
                    lastToken = toWrite
                    status("Secure token written to tag.")
                }
                .onFailure { status("Could not write token: ${it.message}") }
        }
    }

    private fun runNetwork(waiting: String, work: () -> String) {
        status(waiting)
        thread {
            val message = runCatching { work() }.fold(
                onSuccess = { it },
                onFailure = { it.message ?: "Request failed" },
            )
            runOnUiThread { status(message) }
        }
    }

    private fun status(message: String) {
        findViewById<TextView>(R.id.statusView).text = message
    }

    private fun toast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }
}
