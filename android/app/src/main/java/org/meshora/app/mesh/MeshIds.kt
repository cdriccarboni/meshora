package org.meshora.app.mesh

import java.util.UUID

/**
 * Identifiants radio MESHORA (contre-audit V0.2 : UUID 128 bits aléatoires, aucun UUID 16 bits
 * réservé aux membres du Bluetooth SIG n'est utilisé).
 * Tirés au hasard le 26/10/2026 ; ne pas modifier sans changer la version du protocole.
 */
object MeshIds {
    /** Service GATT MESHORA. */
    val SERVICE: UUID = UUID.fromString("120689f9-ed0b-4ef8-a491-cc457d12b459")
    /** Caractéristique d'écriture (le central écrit des trames vers le périphérique). */
    val CHAR_RX: UUID = UUID.fromString("8168e5af-7c92-4c8a-a685-a33a570a1a83")
    /** Caractéristique de notification (le périphérique pousse des trames vers le central). */
    val CHAR_TX: UUID = UUID.fromString("e156230b-847c-42a1-a71c-d05348a61451")
}
