import React, { useState, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Linking, Platform, Switch } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";

/**
 * QuickLaunchEditor - Edit quest action (URL, app protocol, or file path)
 */
export function QuickLaunchEditor({ value, onChange, disabled = false }) {
  const [testStatus, setTestStatus] = useState(null); // null | "success" | "error"
  const fileInputRef = useRef(null);
  
  const actionType = value?.type || "url";
  const actionValue = value?.value || "";
  const openOnStart = value?.openOnStart !== false;

  function handleTypeChange(type) {
    if (disabled) return;
    onChange?.({ type, value: actionValue, openOnStart });
  }

  function handleValueChange(text) {
    if (disabled) return;
    onChange?.({ type: actionType, value: text, openOnStart });
  }

  function handleOpenOnStartChange(next) {
    if (disabled) return;
    // Preserve current type/value; only toggle auto-open behavior.
    onChange?.({ type: actionType, value: actionValue, openOnStart: !!next });
  }

  function handleClear() {
    if (disabled) return;
    onChange?.(null);
    setTestStatus(null);
  }

  // Web file picker
  function handleFilePick() {
    if (Platform.OS !== "web" || disabled) return;
    fileInputRef.current?.click();
  }

  // Native file picker (iOS/Android)
  async function handleNativeFilePick() {
    if (Platform.OS === "web" || disabled) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        multiple: false,
        copyToCacheDirectory: false,
      });

      // expo-document-picker API differs a bit across versions
      const canceled = result?.canceled === true || result?.type === "cancel";
      if (canceled) return;

      const uri = result?.assets?.[0]?.uri ?? result?.uri ?? null;
      if (!uri) return;

      onChange?.({ type: "file", value: uri, openOnStart });
      setTestStatus(null);
    } catch (e) {
      console.log("Native file pick failed:", e);
      setTestStatus("error");
      setTimeout(() => setTestStatus(null), 2000);
    }
  }

  function handleFileSelected(event) {
    const file = event.target.files?.[0];
    if (file) {
      // On web, we get a File object. We'll store the name as a reference.
      // Note: Due to browser security, we can't get the full path.
      // We'll store what we can and note the limitation.
      const filePath = file.name;
      onChange?.({ type: "file", value: filePath });
    }
    // Reset input so same file can be selected again
    event.target.value = "";
  }

  async function handleTest() {
    if (!actionValue.trim()) {
      setTestStatus("error");
      setTimeout(() => setTestStatus(null), 2000);
      return;
    }

    const startedAt = Date.now();
    const debugBase = {
      component: "QuickLaunchEditor",
      actionType,
      rawValue: actionValue,
      platform: Platform.OS,
      startedAt,
    };

    try {
      let url = actionValue.trim();
      
      if (actionType === "url") {
        // Auto-add protocol if missing
        if (!/^https?:\/\//i.test(url)) {
          url = "https://" + url;
        }
      } else if (actionType === "file") {
        // If it's already a URI (file://, content://, etc), keep it.
        if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url)) {
          // Convert Windows paths
          if (/^[a-zA-Z]:/.test(url)) {
            url = "file:///" + url.replace(/\\/g, "/");
          } else if (!url.startsWith("/")) {
            url = "file:///" + url;
          } else {
            url = "file://" + url;
          }
        }
      }
      // For "app" type, use the value as-is (protocol handler)
      
      const canOpen = await Linking.canOpenURL(url);

      // Debug logging: show what we tried and why it may fail (include stack).
      const debug = {
        ...debugBase,
        resolvedUrl: url,
        canOpenURL: !!canOpen,
        elapsedMs: Date.now() - startedAt,
      };
      console.log("[QuickLaunch Test]", debug);
      console.log(
        "[QuickLaunch Test stack]",
        new Error("QuickLaunchEditor.handleTest stack").stack
      );
      
      // Note: iOS often returns canOpenURL=false for file:// URLs even when openURL works.
      // So we treat canOpenURL as a hint, not a gate. We try to open and only fail on throw.
      if (Platform.OS === "web") {
        window.open(url, "_blank");
        setTestStatus("success");
        return;
      }

      try {
        // For local files on iOS, Sharing (Quick Look / Open In) is more reliable than Linking.openURL(file://).
        if (actionType === "file" && (url.startsWith("file://") || url.startsWith("content://"))) {
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(url);
            setTestStatus("success");
            return;
          }
        }

        await Linking.openURL(url);
        setTestStatus("success");
      } catch (openErr) {
        console.log("[QuickLaunch Test openURL failed]", {
          ...debugBase,
          resolvedUrl: url,
          canOpenURL: !!canOpen,
          elapsedMs: Date.now() - startedAt,
          errName: openErr?.name ?? null,
          errMessage: openErr?.message ?? String(openErr),
          errStack: openErr?.stack ?? null,
        });
        setTestStatus("error");
      }
    } catch (e) {
      const err = e;
      console.log("[QuickLaunch Test failed]", {
        ...debugBase,
        elapsedMs: Date.now() - startedAt,
        errName: err?.name ?? null,
        errMessage: err?.message ?? String(err),
        errStack: err?.stack ?? null,
      });
      console.log(
        "[QuickLaunch Test failed stack]",
        err?.stack ?? new Error("QuickLaunchEditor.handleTest fallback stack").stack
      );
      setTestStatus("error");
    }
    
    setTimeout(() => setTestStatus(null), 2000);
  }

  const getPlaceholder = () => {
    switch (actionType) {
      case "url": return "mathacademy.com";
      case "app": return "spotify: or notion: or slack:";
      case "file": return "C:\\Program Files\\app.exe";
      default: return "";
    }
  };

  const getExamples = () => {
    switch (actionType) {
      case "url": return "Opens website in browser";
      case "app": return "App protocols: spotify:, notion:, slack:, zoom:";
      case "file": return "Full path to file or executable";
      default: return "";
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Quick Launch</Text>
        <Text style={styles.optional}>(optional)</Text>
      </View>
      <Text style={styles.helper}>
        Open something when you start this quest
      </Text>
      
      {/* Type picker */}
      <View style={styles.typePicker}>
        <TouchableOpacity
          style={[styles.typeBtn, actionType === "url" && styles.typeBtnActive]}
          onPress={() => handleTypeChange("url")}
          disabled={disabled}
        >
          <Text style={[styles.typeBtnText, actionType === "url" && styles.typeBtnTextActive]}>
            🔗 URL
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeBtn, actionType === "app" && styles.typeBtnActive]}
          onPress={() => handleTypeChange("app")}
          disabled={disabled}
        >
          <Text style={[styles.typeBtnText, actionType === "app" && styles.typeBtnTextActive]}>
            📱 App
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeBtn, actionType === "file" && styles.typeBtnActive]}
          onPress={() => handleTypeChange("file")}
          disabled={disabled}
        >
          <Text style={[styles.typeBtnText, actionType === "file" && styles.typeBtnTextActive]}>
            📁 File
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Value input */}
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, disabled && styles.inputDisabled]}
          value={actionValue}
          onChangeText={handleValueChange}
          placeholder={getPlaceholder()}
          placeholderTextColor="#6b7280"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!disabled}
        />
        {actionType === "file" && Platform.OS === "web" && (
          <TouchableOpacity 
            style={styles.browseBtn} 
            onPress={handleFilePick}
            disabled={disabled}
          >
            <Text style={styles.browseBtnText}>Browse</Text>
          </TouchableOpacity>
        )}
        {actionType === "file" && Platform.OS !== "web" && (
          <TouchableOpacity
            style={styles.browseBtn}
            onPress={handleNativeFilePick}
            disabled={disabled}
          >
            <Text style={styles.browseBtnText}>Browse</Text>
          </TouchableOpacity>
        )}
        {actionValue.trim() && (
          <TouchableOpacity style={styles.clearBtn} onPress={handleClear} disabled={disabled}>
            <Text style={styles.clearBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Hidden file input for web */}
      {Platform.OS === "web" && (
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: "none" }}
          onChange={handleFileSelected}
          accept="*"
        />
      )}
      
      {/* Examples and test button */}
      <View style={styles.footer}>
        <Text style={styles.examples}>{getExamples()}</Text>
        {actionValue.trim() && (
          <TouchableOpacity 
            style={[
              styles.testBtn,
              testStatus === "success" && styles.testBtnSuccess,
              testStatus === "error" && styles.testBtnError,
            ]} 
            onPress={handleTest}
            disabled={disabled}
          >
            <Text style={styles.testBtnText}>
              {testStatus === "success" ? "✓ Opened" : testStatus === "error" ? "✕ Failed" : "Test"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Auto-open toggle */}
      {!!actionValue.trim() && (
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Open on quest start</Text>
            <Text style={styles.toggleSubtitle}>
              If off, you can still press “Open” manually from the quest.
            </Text>
          </View>
          <Switch
            value={openOnStart}
            onValueChange={handleOpenOnStartChange}
            disabled={disabled}
          />
        </View>
      )}

      {/* Platform note for file type */}
      {actionType === "file" && (
        <Text style={styles.note}>
          💡 Paste the full path. Browser security may limit file access.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    color: "#e5e7eb",
    fontSize: 14,
    fontWeight: "600",
  },
  optional: {
    color: "#6b7280",
    fontSize: 12,
  },
  helper: {
    color: "#6b7280",
    fontSize: 11,
    marginTop: 2,
    marginBottom: 10,
  },
  typePicker: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1f2937",
    alignItems: "center",
  },
  typeBtnActive: {
    borderColor: "#4f46e5",
    backgroundColor: "#1e1b4b",
  },
  typeBtnText: {
    color: "#9ca3af",
    fontSize: 12,
  },
  typeBtnTextActive: {
    color: "#e5e7eb",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1f2937",
    backgroundColor: "#0f172a",
    padding: 10,
    color: "#e5e7eb",
    fontSize: 14,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  browseBtn: {
    marginLeft: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: "#374151",
  },
  browseBtnText: {
    color: "#e5e7eb",
    fontSize: 12,
    fontWeight: "500",
  },
  clearBtn: {
    marginLeft: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#374151",
    alignItems: "center",
    justifyContent: "center",
  },
  clearBtnText: {
    color: "#9ca3af",
    fontSize: 12,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  examples: {
    color: "#4b5563",
    fontSize: 11,
    flex: 1,
  },
  testBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#1f2937",
  },
  testBtnSuccess: {
    backgroundColor: "#14532d",
  },
  testBtnError: {
    backgroundColor: "#7f1d1d",
  },
  testBtnText: {
    color: "#e5e7eb",
    fontSize: 12,
  },
  note: {
    color: "#6b7280",
    fontSize: 10,
    marginTop: 6,
    fontStyle: "italic",
  },
  toggleRow: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1f2937",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  toggleTitle: {
    color: "#e5e7eb",
    fontSize: 12,
    fontWeight: "600",
  },
  toggleSubtitle: {
    marginTop: 2,
    color: "#6b7280",
    fontSize: 11,
  },
});

export default QuickLaunchEditor;
