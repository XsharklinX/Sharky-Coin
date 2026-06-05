package com.sharky.finanzas

import android.graphics.Color
import android.os.Bundle

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window.statusBarColor = Color.parseColor("#1B1B1B")
    window.navigationBarColor = Color.parseColor("#151515")
  }
}
