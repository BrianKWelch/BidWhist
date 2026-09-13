package com.brianwelch.smsvault.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.brianwelch.smsvault.data.MessageWithAttachments
import com.brianwelch.smsvault.data.ThreadSummary
import com.brianwelch.smsvault.data.VaultMessage
import com.brianwelch.smsvault.data.VaultNumber
import com.brianwelch.smsvault.data.VaultRepository
import com.brianwelch.smsvault.role.PurgeManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class AppViewModel(app: Application) : AndroidViewModel(app) {

    private val repo = VaultRepository.get(app)

    val numbers: StateFlow<List<VaultNumber>> =
        repo.observeNumbers().stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    val threads: StateFlow<List<ThreadSummary>> =
        repo.observeThreads().stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    val pendingDeleteCount: StateFlow<Int> =
        repo.observePendingDeleteCount().stateIn(viewModelScope, SharingStarted.Eagerly, 0)

    private val _sweepResult = MutableStateFlow<PurgeManager.SweepResult?>(null)
    val sweepResult: StateFlow<PurgeManager.SweepResult?> = _sweepResult

    private val _importResult = MutableStateFlow<PurgeManager.ImportResult?>(null)
    val importResult: StateFlow<PurgeManager.ImportResult?> = _importResult

    fun threadMessages(threadKey: String): Flow<List<VaultMessage>> =
        repo.observeThreadMessages(threadKey)

    suspend fun attachmentsFor(messages: List<VaultMessage>): List<MessageWithAttachments> =
        withContext(Dispatchers.IO) { repo.messagesWithAttachments(messages) }

    fun addNumber(e164: String, label: String?) = viewModelScope.launch(Dispatchers.IO) {
        repo.addNumber(e164, label)
    }

    fun renameNumber(id: Long, label: String?) = viewModelScope.launch(Dispatchers.IO) {
        repo.renameNumber(id, label)
    }

    fun deleteNumber(id: Long) = viewModelScope.launch(Dispatchers.IO) {
        repo.deleteNumber(id)
    }

    fun runSweep() = viewModelScope.launch(Dispatchers.IO) {
        _sweepResult.value = PurgeManager.runSweep(getApplication())
    }

    fun runHistoricalImport(deleteAfter: Boolean) = viewModelScope.launch(Dispatchers.IO) {
        _importResult.value = PurgeManager.historicalImport(getApplication(), deleteAfter)
    }

    fun clearSweepResult() { _sweepResult.value = null }
    fun clearImportResult() { _importResult.value = null }
}
