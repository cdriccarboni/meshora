package org.meshora.app

import android.app.Application
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.meshora.app.storage.IdentityStorage
import org.meshora.app.storage.OutboxRepository
import org.meshora.app.transport.TransportManager
import org.meshora.app.transport.ble.MeshoraBleManager

class MeshoraApp : Application() {
    val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    lateinit var identityStorage: IdentityStorage
        private set
    lateinit var outboxRepository: OutboxRepository
        private set
    lateinit var bleManager: MeshoraBleManager
        private set
    lateinit var transportManager: TransportManager
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this

        identityStorage = IdentityStorage(this)
        outboxRepository = OutboxRepository(this)
        bleManager = MeshoraBleManager(this)
        transportManager = TransportManager(
            scope = applicationScope,
            identity = identityStorage.getOrCreateIdentity(),
            outboxRepository = outboxRepository,
            bleManager = bleManager
        )
    }

    companion object {
        lateinit var instance: MeshoraApp
            private set
    }
}
