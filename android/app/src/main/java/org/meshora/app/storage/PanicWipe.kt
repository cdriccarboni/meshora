package org.meshora.app.storage

import android.app.ActivityManager
import android.content.Context
import org.meshora.app.MeshoraApp

/**
 * Effacement d'urgence (V0.4). Efface de CET appareil : clé d'identité (et sa clé d'emballage du magasin Android),
 * messages, file d'envoi, contacts, groupe, réglages, caches. Irréversible ; l'application se ferme.
 * Ne peut rien effacer chez les destinataires ni sur le relais (courrier en attente chiffré, expiré après 24 h au plus).
 */
object PanicWipe {
    val PREFS = listOf("meshora_identity", "meshora_messages", "meshora_contacts", "meshora_settings", PrekeyStore.PREFS)

    fun wipe(context: Context) {
        val app = context.applicationContext
        runCatching { MeshoraApp.instance.transportManager.disconnectWebSocket() }
        runCatching { MeshoraApp.instance.bleMesh.stop() }
        SecureKeyBox.destroy()
        for (name in PREFS) {
            runCatching { app.getSharedPreferences(name, Context.MODE_PRIVATE).edit().clear().commit() }
            runCatching { app.deleteSharedPreferences(name) }
        }
        runCatching { app.cacheDir.deleteRecursively() }
        // Efface toutes les autres données de l'application (fichiers, bases, données de Tor) et la ferme.
        app.getSystemService(ActivityManager::class.java)?.clearApplicationUserData()
    }
}
