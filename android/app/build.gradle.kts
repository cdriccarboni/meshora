import java.io.File
import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// Signature de publication : JAMAIS dans le dépôt (contre-audit V0.2).
// Fichier hors dépôt : $MESHORA_SIGNING_PROPERTIES ou ~/.meshora/signing.properties
//   storeFile=/chemin/absolu/vers/la/cle.jks
//   keyAlias=meshora-upload
// Les mots de passe ne sont écrits nulle part sur disque : ils viennent des variables
// MESHORA_KEYSTORE_PASSWORD / MESHORA_KEY_PASSWORD, que tools/android/build-signed.sh lit
// dans le trousseau macOS. (storePassword/keyPassword dans le fichier restent acceptés, déconseillés.)
val signingProps = Properties().apply {
    val path = System.getenv("MESHORA_SIGNING_PROPERTIES")
        ?: (System.getProperty("user.home") + "/.meshora/signing.properties")
    val f = File(path)
    if (f.exists()) f.inputStream().use { load(it) }
}
val releaseStoreFile: String? = signingProps.getProperty("storeFile")
val releaseKeyAlias: String? = signingProps.getProperty("keyAlias")
val releaseStorePassword: String? = System.getenv("MESHORA_KEYSTORE_PASSWORD") ?: signingProps.getProperty("storePassword")
val releaseKeyPassword: String? = System.getenv("MESHORA_KEY_PASSWORD") ?: signingProps.getProperty("keyPassword") ?: releaseStorePassword
val hasReleaseSigning = listOf(releaseStoreFile, releaseKeyAlias, releaseStorePassword, releaseKeyPassword)
    .all { !it.isNullOrBlank() } && File(releaseStoreFile!!).let { it.isAbsolute && it.exists() }

android {
    namespace = "org.meshora.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "org.meshora.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 7
        versionName = "0.3.0-beta2-tor"

        // Bibliothèques natives (Tor) : téléphones ARM 64/32 bits et émulateur x86_64
        ndk { abiFilters += listOf("arm64-v8a", "armeabi-v7a", "x86_64") }

        // Relais de référence et adresse des invitations. Préproduction par défaut ;
        // la bascule en production (-Pmeshora.channel=production) exige l'accord du directeur artistique.
        val channel = (project.findProperty("meshora.channel") as String?) ?: "preprod"
        val relay = (project.findProperty("meshora.relayUrl") as String?)
            ?: if (channel == "production") "wss://meshora-relay.acousmaticregietools.workers.dev"
               else "wss://meshora-relay-preprod.acousmaticregietools.workers.dev"
        val inviteBase = (project.findProperty("meshora.inviteBase") as String?)
            ?: if (channel == "production") "https://meshora.pages.dev/app/" else "https://v0-3.meshora.pages.dev/app/"
        buildConfigField("String", "DEFAULT_RELAY_URL", "\"$relay\"")
        buildConfigField("String", "RELAY_CHANNEL", "\"$channel\"")
        buildConfigField("String", "INVITE_BASE_URL", "\"$inviteBase\"")

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = File(releaseStoreFile!!)
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            // Sans configuration de signature hors dépôt, la version de publication reste NON signée
            // (pas de repli silencieux sur la clé de débogage).
            if (hasReleaseSigning) signingConfig = signingConfigs.getByName("release")
        }
        debug {
            applicationIdSuffix = ".debug"
            isDebuggable = true
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.material.icons.extended)
    implementation(libs.androidx.navigation.compose)

    // WebSocket / Network
    implementation(libs.okhttp)

    // QR code des invitations (génération seulement, Apache-2.0)
    implementation(libs.zxing.core)

    // Tor intégré (Guardian Project, BSD) — mode Tor expérimental, désactivé par défaut
    implementation(libs.tor.android)
    implementation(libs.jtorctl)

    // Serialization
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.core)
    implementation(libs.kotlinx.coroutines.android)

    // Testing
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.ui.test.junit4)
    debugImplementation(libs.androidx.ui.tooling)
    debugImplementation(libs.androidx.ui.test.manifest)
}

// Essai d'interopérabilité Android ↔ web (tools/audit/interop-android.sh) : transmis aux tests JVM.
tasks.withType<Test>().configureEach {
    environment("MESHORA_INTEROP_RELAY", System.getenv("MESHORA_INTEROP_RELAY") ?: "")
    environment("MESHORA_INTEROP_ROOM", System.getenv("MESHORA_INTEROP_ROOM") ?: "interop")
}
