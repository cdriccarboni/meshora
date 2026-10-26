package org.meshora.app

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assert.*
import org.junit.Test
import org.meshora.app.crypto.CryptoEngine
import org.meshora.app.transport.ConnectionState
import org.meshora.app.transport.RelayProblem
import org.meshora.app.transport.WebSocketTransport
import java.net.ServerSocket
import java.util.concurrent.atomic.AtomicInteger
import kotlin.concurrent.thread

/** Mode Tor : tant que Tor n'est pas prêt, aucune connexion directe au relais (échec fermé). */
class TorFailClosedTest {
    @Test
    fun noDirectConnectionWhileTorNotReady() {
        // Faux relais local : compte toute tentative de connexion TCP.
        val server = ServerSocket(0)
        val attempts = AtomicInteger(0)
        thread(isDaemon = true) { while (!server.isClosed) runCatching { server.accept().close(); attempts.incrementAndGet() } }

        val ws = WebSocketTransport(CoroutineScope(SupervisorJob() + Dispatchers.Default), {}, {}, {})
        ws.requireProxy = true
        ws.proxyProvider = { null } // Tor pas prêt
        assertTrue(ws.connect("ws://127.0.0.1:${server.localPort}", "g1234", CryptoEngine.generateIdentityKeyPair()))
        Thread.sleep(1500)
        ws.reconnectNow()
        Thread.sleep(500)

        assertEquals("aucune connexion directe", 0, attempts.get())
        assertEquals(RelayProblem.WAITING_FOR_TOR, ws.problem.value)
        assertEquals(ConnectionState.DISCONNECTED, ws.connectionState.value)

        // Sans mode Tor, la même adresse est bien contactée (le test détecte donc les connexions).
        ws.requireProxy = false
        ws.reconnectNow()
        Thread.sleep(1500)
        assertTrue("connexion directe hors mode Tor", attempts.get() > 0)
        ws.disconnect()
        server.close()
    }
}
