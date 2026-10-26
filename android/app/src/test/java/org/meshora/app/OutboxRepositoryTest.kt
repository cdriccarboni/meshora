package org.meshora.app

import org.junit.Assert.*
import org.junit.Test
import org.meshora.app.model.Message
import org.meshora.app.model.MessageStatus
import org.meshora.app.storage.OutboxRepository

class OutboxRepositoryTest {

    @Test
    fun testOutboxRetentionUntilSignedAck() {
        val repo = OutboxRepository(null)

        val message = Message(
            id = "msg-outbox-001",
            conversationId = "conv-1",
            senderFingerprint = "1111:2222:3333:4444",
            recipientFingerprint = "5555:6666:7777:8888",
            senderPublicKeyHex = "04aaaa",
            recipientPublicKeyHex = "04bbbb",
            content = "Alerte de test Outbox",
            timestamp = System.currentTimeMillis(),
            status = MessageStatus.QUEUED,
            transportUsed = "outbox"
        )

        // 1. Enregistrement initial dans l'Outbox
        repo.enqueueMessage(message)
        val pending1 = repo.getPendingOutbox()
        assertEquals(1, pending1.size)
        assertEquals(MessageStatus.QUEUED, pending1[0].status)

        // 2. Émission filaire sans accusé de réception -> Statut SENT mais toujours dans l'Outbox
        repo.markSent("msg-outbox-001", "WebSocket")
        val pending2 = repo.getPendingOutbox()
        assertEquals("Le message doit rester dans l'Outbox en statut SENT tant qu'il n'est pas acquitté", 1, pending2.size)
        assertEquals(MessageStatus.SENT, pending2[0].status)

        // 3. Arrivée de l'ACK signé -> Passage en DELIVERED et libération de l'Outbox
        repo.markDelivered("msg-outbox-001")
        val pending3 = repo.getPendingOutbox()
        assertEquals("L'Outbox doit être vide une fois l'ACK reçu", 0, pending3.size)

        val allMessages = repo.messagesFlow.value
        assertEquals(1, allMessages.size)
        assertEquals(MessageStatus.DELIVERED, allMessages[0].status)
    }

    @Test
    fun testMessageDeduplication() {
        val repo = OutboxRepository(null)

        assertFalse(repo.hasSeenMessage("msg-unique-123"))
        repo.recordSeenMessage("msg-unique-123")
        assertTrue(repo.hasSeenMessage("msg-unique-123"))
    }
}
