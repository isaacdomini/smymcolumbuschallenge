import UIKit
import Capacitor

class MainViewController: CAPBridgeViewController {

  override func viewDidLoad() {
    super.viewDidLoad()
    
    // Enable the iOS swipe back gesture
    self.webView.allowsBackForwardNavigationGestures = true;
  }

}