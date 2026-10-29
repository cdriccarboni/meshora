package org.meshora.app.transport.ble

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import org.meshora.app.MainActivity
import org.meshora.app.MeshoraApp
import org.meshora.app.R

/**
 * Service de premier plan du maillage Bluetooth (décision du directeur artistique, 27/10/2026 :
 * « le principe est de pouvoir communiquer, pas d'économiser la batterie »).
 *
 * Tant que le Bluetooth MESHORA est activé, ce service garde l'application en vie écran éteint :
 * annonce, balayage filtré, serveur GATT et relais des trames continuent, avec un verrou de veille partiel
 * pour que les annonces et renvois périodiques ne soient pas suspendus par la mise en veille.
 * Une notification permanente l'indique, avec un bouton « Arrêter ». Coût : batterie.
 */
class MeshoraBleService : Service() {
    companion object {
        const val CHANNEL_ID = "meshora_ble_channel"
        const val NOTIFICATION_ID = 4201
        private const val ACTION_STOP = "org.meshora.app.ble.STOP"
        private const val WAKE_TAG = "meshora:ble-mesh"

        /** Appelé par [BleMesh.start] (application au premier plan : démarrage autorisé). */
        fun start(context: Context) {
            val intent = Intent(context, MeshoraBleService::class.java)
            runCatching {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent)
                else context.startService(intent)
            }
        }

        fun stop(context: Context) {
            runCatching { context.stopService(Intent(context, MeshoraBleService::class.java)) }
        }
    }

    private var wakeLock: PowerManager.WakeLock? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        try {
            ServiceCompat.startForeground(
                this, NOTIFICATION_ID, buildNotification(),
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE else 0
            )
        } catch (_: Exception) {
            // Démarrage refusé par le système (permissions Bluetooth retirées, démarrage en arrière-plan interdit…) :
            // le maillage reste utilisable application ouverte.
            stopSelf()
            return
        }
        acquireWakeLock()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val mesh = runCatching { MeshoraApp.instance.bleMesh }.getOrNull()
        when {
            intent?.action == ACTION_STOP -> {
                mesh?.stop() // arrête aussi ce service
                stopSelf()
                return START_NOT_STICKY
            }
            // Relance par le système après l'arrêt du processus (intent nul) : on rouvre le maillage si possible.
            intent == null && mesh != null && !mesh.running.value -> {
                if (!mesh.start()) { stopSelf(); return START_NOT_STICKY }
            }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        releaseWakeLock()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    @SuppressLint("WakelockTimeout") // tenu volontairement tant que le maillage est actif ; relâché à l'arrêt
    private fun acquireWakeLock() {
        if (wakeLock?.isHeld == true) return
        wakeLock = (getSystemService(Context.POWER_SERVICE) as? PowerManager)
            ?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKE_TAG)
            ?.apply { setReferenceCounted(false); acquire() }
    }

    private fun releaseWakeLock() {
        runCatching { if (wakeLock?.isHeld == true) wakeLock?.release() }
        wakeLock = null
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, getString(R.string.ble_channel_name), NotificationManager.IMPORTANCE_LOW).apply {
                description = getString(R.string.ble_channel_description)
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        val stop = PendingIntent.getService(
            this, 1, Intent(this, MeshoraBleService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.ble_notif_title))
            .setContentText(getString(R.string.ble_notif_text))
            .setStyle(NotificationCompat.BigTextStyle().bigText(getString(R.string.ble_notif_text)))
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(open)
            .addAction(0, getString(R.string.ble_stop), stop)
            .setOngoing(true)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build()
    }
}
