import UIKit
import Capacitor

class MainViewController: CAPBridgeViewController {

  // Use viewDidLoad, which is called *after* the view hierarchy has been loaded.
  // This is the correct place to modify properties of the view.
  override func viewDidLoad() {
    super.viewDidLoad()
    
    // Enable the iOS swipe back gesture
    self.webView?.allowsBackForwardNavigationGestures = true
  }

}
