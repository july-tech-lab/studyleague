import ExpoModulesCore
import FamilyControls
import ManagedSettings
import UIKit
import SwiftUI
import Combine

public class FocusModule: Module {
  // Use a named store tied to your App Group for persistent shields
  // This ensures shields persist even if the app is killed
  private var settingsStore = ManagedSettingsStore(named: .init("group.com.juliemaitre.studyleague"))
  private var selectedApps: FamilyActivitySelection?
  
  // App Group identifier for persisting selections
  // Note: This must match the App Group added in Xcode Signing & Capabilities
  private let appGroupIdentifier = "group.com.juliemaitre.studyleague"
  private let selectionKey = "familyActivitySelection"
  
  public override init() {
    super.init()
    // Load persisted selection on module initialization
    loadPersistedSelection()
  }
  
  public func definition() -> ModuleDefinition {
    Name("FocusModule")

    AsyncFunction("checkPermission") {
      let authorizationCenter = AuthorizationCenter.shared
      return authorizationCenter.authorizationStatus == .approved
    }

    AsyncFunction("requestPermission") {
      let authorizationCenter = AuthorizationCenter.shared
      try await authorizationCenter.requestAuthorization(for: .individual)
    }

    AsyncFunction("presentFamilyActivityPicker") {
      return try await withCheckedThrowingContinuation { continuation in
        DispatchQueue.main.async {
          guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                let rootViewController = windowScene.windows.first?.rootViewController else {
            continuation.resume(throwing: NSError(domain: "FocusModule", code: 2, userInfo: [NSLocalizedDescriptionKey: "Could not find root view controller"]))
            return
          }
          
          // Create a state object to hold the selection
          let selectionState = SelectionState()
          selectionState.continuation = continuation
          selectionState.module = self
          
          // Create the SwiftUI picker view with binding
          let picker = FamilyActivityPicker(selection: Binding(
            get: { selectionState.selection },
            set: { selectionState.selection = $0 }
          ))
          
          let hostingController = UIHostingController(rootView: picker)
          hostingController.modalPresentationStyle = .pageSheet
          
          // Store the state to prevent deallocation
          objc_setAssociatedObject(hostingController, "selectionState", selectionState, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
          
          rootViewController.present(hostingController, animated: true)
        }
      }
    }

    AsyncFunction("setFocusMode") { (enabled: Bool) in
      let authorizationCenter = AuthorizationCenter.shared
      
      guard authorizationCenter.authorizationStatus == .approved else {
        throw NSError(domain: "FocusModule", code: 1, userInfo: [NSLocalizedDescriptionKey: "Screen Time permission not granted"])
      }
      
      if enabled {
        // Enable focus mode by applying shields to selected apps
        guard let selection = self.selectedApps else {
          throw NSError(domain: "FocusModule", code: 4, userInfo: [NSLocalizedDescriptionKey: "No apps selected. Please select apps to block first."])
        }
        
        // Apply tokens to the shield
        settingsStore.shield.applications = selection.applicationTokens
        settingsStore.shield.applicationCategories = .specific(selection.categoryTokens)
        settingsStore.shield.webDomains = selection.webDomainTokens
      } else {
        // Clear all restrictions
        settingsStore.shield.applications = nil
        settingsStore.shield.applicationCategories = nil
        settingsStore.shield.webDomains = nil
      }
    }
    
    Function("getSelectedApps") {
      // Return if apps are selected (we can't serialize FamilyActivitySelection to JS)
      return self.selectedApps != nil
    }
  }
  
  func setSelectedApps(_ selection: FamilyActivitySelection) {
    self.selectedApps = selection
    // Persist the selection to App Group UserDefaults
    persistSelection(selection)
  }
  
  // Persist FamilyActivitySelection to App Group UserDefaults
  // Note: FamilyActivitySelection supports encoding in iOS 15+
  private func persistSelection(_ selection: FamilyActivitySelection) {
    guard let sharedDefaults = UserDefaults(suiteName: appGroupIdentifier) else {
      print("Warning: Could not access App Group UserDefaults. App Group may not be configured in Xcode.")
      print("Please add App Group '\(appGroupIdentifier)' in Xcode Signing & Capabilities.")
      return
    }
    
    // Try JSON encoding first (iOS 15+ supports Codable)
    if let encoded = try? JSONEncoder().encode(selection) {
      sharedDefaults.set(encoded, forKey: selectionKey)
      sharedDefaults.synchronize()
      return
    }
    
    // Fallback to NSKeyedArchiver
    do {
      let data = try NSKeyedArchiver.archivedData(withRootObject: selection, requiringSecureCoding: false)
      sharedDefaults.set(data, forKey: selectionKey)
      sharedDefaults.synchronize()
    } catch {
      print("Warning: Could not persist FamilyActivitySelection: \(error.localizedDescription)")
      // Store a flag that selection exists (user will need to reselect if app restarts)
      sharedDefaults.set(true, forKey: "\(selectionKey)_exists")
    }
  }
  
  // Load persisted FamilyActivitySelection from App Group UserDefaults
  private func loadPersistedSelection() {
    guard let sharedDefaults = UserDefaults(suiteName: appGroupIdentifier) else {
      return
    }
    
    // Try JSON decoding first
    if let data = sharedDefaults.data(forKey: selectionKey),
       let selection = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data) {
      self.selectedApps = selection
      return
    }
    
    // Fallback to NSKeyedUnarchiver
    if let data = sharedDefaults.data(forKey: selectionKey) {
      do {
        let unarchiver = try NSKeyedUnarchiver(forReadingFrom: data)
        unarchiver.requiresSecureCoding = false
        if let selection = unarchiver.decodeObject(of: FamilyActivitySelection.self, forKey: NSKeyedArchiveRootObjectKey) {
          self.selectedApps = selection
          return
        }
      } catch {
        print("Note: Could not unarchive FamilyActivitySelection: \(error.localizedDescription)")
      }
    }
    
    // Check fallback flag
    if sharedDefaults.bool(forKey: "\(selectionKey)_exists") {
      print("Note: Previous app selection exists but cannot be restored. User will need to reselect apps.")
    }
  }
}

// Helper class to manage picker state
// FamilyActivityPicker uses SwiftUI bindings - selection updates as user picks apps
class SelectionState: ObservableObject {
  @Published var selection: FamilyActivitySelection? {
    didSet {
      // When selection changes, save it immediately
      // The picker allows continuous selection, so we save on each change
      if let selection = selection {
        module?.setSelectedApps(selection)
      }
    }
  }
  var continuation: CheckedContinuation<Void, Error>?
  weak var module: FocusModule?
  
  // Note: FamilyActivityPicker doesn't have explicit Done/Cancel buttons
  // The selection binding updates as the user selects, and the picker dismisses automatically
  // We'll need to handle completion via a timer or observe when the view controller is dismissed
}
