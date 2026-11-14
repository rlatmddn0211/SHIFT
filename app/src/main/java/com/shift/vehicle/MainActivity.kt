package com.shift.vehicle

import android.app.Activity
import android.app.AlertDialog
import android.os.Bundle

class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(TodayVisitsView(this, ::previewDestination))
    }

    private fun previewDestination(address: String) {
        AlertDialog.Builder(this)
            .setTitle(R.string.destination_preview_title)
            .setMessage(getString(R.string.destination_preview_message, address))
            .setPositiveButton(android.R.string.ok, null)
            .show()
    }
}
