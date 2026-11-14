plugins {
    id("com.android.application") version "8.13.2"
    id("org.jetbrains.kotlin.android") version "2.2.21"
}

val emulatorApiOrigin = "http://10.0.2.2:8787"
val shiftApiOrigin = providers.gradleProperty("shiftApiOrigin").orElse(emulatorApiOrigin)
val shiftReleaseApiOrigin = providers.gradleProperty("shiftReleaseApiOrigin").orElse(emulatorApiOrigin)

android {
    namespace = "com.shift.vehicle"
    compileSdk = 34
    useLibrary("android.car")

    defaultConfig {
        applicationId = "com.shift.vehicle"
        minSdk = 28
        targetSdk = 34
        versionCode = 2
        versionName = "0.2.0"
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        debug {
            val origin = shiftApiOrigin.get().trimEnd('/')
            require(Regex("https?://[A-Za-z0-9.:-]+").matches(origin)) {
                "shiftApiOrigin must be an HTTP(S) origin without a path"
            }
            buildConfigField("String", "SHIFT_API_ORIGIN", "\"$origin\"")
        }
        release {
            val origin = shiftReleaseApiOrigin.get().trimEnd('/')
            require(origin == emulatorApiOrigin || Regex("https://[A-Za-z0-9.:-]+").matches(origin)) {
                "shiftReleaseApiOrigin must be $emulatorApiOrigin or an HTTPS origin without a path"
            }
            buildConfigField("String", "SHIFT_API_ORIGIN", "\"$origin\"")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    implementation("com.google.zxing:core:3.5.4")
    implementation("ai.pleos.playground:NaviHelper:3.0.5")
    implementation("ai.pleos.playground:Vehicle:2.3.2")
    implementation("ai.pleos.playground:TextToSpeech:3.3.1")
    implementation("ai.pleos.playground:SpeechToText:3.3.1")
}
