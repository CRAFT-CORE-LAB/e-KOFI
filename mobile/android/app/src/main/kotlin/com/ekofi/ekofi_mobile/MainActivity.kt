package com.ekofi.ekofi_mobile

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val permissionAction = "com.ekofi.ekofi_mobile.USB_PERMISSION"
    private val zktecoVendorId = 0x1b55
    private val readerProductIds = setOf(0x0120, 0x0124)

    private var pendingResult: MethodChannel.Result? = null
    private var permissionReceiver: BroadcastReceiver? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var timeout: Runnable? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "ekofi/usb_reader")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "status" -> result.success(readerStatus())
                    "requestAccess" -> requestAccess(result)
                    else -> result.notImplemented()
                }
            }
    }

    private fun usbManager(): UsbManager? = getSystemService(Context.USB_SERVICE) as? UsbManager

    private fun readerDevice(): UsbDevice? =
        usbManager()?.deviceList?.values?.firstOrNull {
            it.vendorId == zktecoVendorId && it.productId in readerProductIds
        }

    private fun readerStatus(): Map<String, Any> {
        val usb = usbManager() ?: return mapOf("present" to false, "permitted" to false)
        val device = readerDevice() ?: return mapOf("present" to false, "permitted" to false)
        return mapOf(
            "present" to true,
            "permitted" to usb.hasPermission(device),
            "name" to (device.productName ?: "Live20R"),
        )
    }

    private fun requestAccess(result: MethodChannel.Result) {
        val usb = usbManager()
        val device = readerDevice()
        if (usb == null || device == null) {
            result.success("absent")
            return
        }
        if (usb.hasPermission(device)) {
            result.success("granted")
            return
        }
        if (pendingResult != null) {
            result.success("busy")
            return
        }
        pendingResult = result
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                if (intent.action != permissionAction) return
                val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
                finishAccess(if (granted) "granted" else "denied")
            }
        }
        permissionReceiver = receiver
        val filter = IntentFilter(permissionAction)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            registerReceiver(receiver, filter)
        }
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or
            (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
        val pending = PendingIntent.getBroadcast(
            this,
            0,
            Intent(permissionAction).setPackage(packageName),
            flags,
        )
        timeout = Runnable { finishAccess("denied") }.also {
            mainHandler.postDelayed(it, 60_000)
        }
        usb.requestPermission(device, pending)
    }

    private fun finishAccess(value: String) {
        val result = pendingResult ?: return
        pendingResult = null
        timeout?.let { mainHandler.removeCallbacks(it) }
        timeout = null
        permissionReceiver?.let {
            try {
                unregisterReceiver(it)
            } catch (_: Exception) {
            }
        }
        permissionReceiver = null
        result.success(value)
    }

    override fun onDestroy() {
        finishAccess("denied")
        super.onDestroy()
    }
}
