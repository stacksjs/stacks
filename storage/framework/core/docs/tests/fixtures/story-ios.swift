import UIKit

// A disposable native fixture, separate from any user's application or data.
final class StoryViewController: UIViewController {
    let titleLabel = UILabel()
    let purchase = UIButton(type: .system)
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        titleLabel.text = "Review cart"
        titleLabel.font = .systemFont(ofSize: 28, weight: .bold)
        titleLabel.textAlignment = .center
        titleLabel.accessibilityIdentifier = "story-title"
        purchase.setTitle("Buy", for: .normal)
        purchase.titleLabel?.font = .systemFont(ofSize: 24, weight: .semibold)
        purchase.accessibilityIdentifier = "story-buy"
        purchase.addTarget(self, action: #selector(buy), for: .touchUpInside)
        view.addSubview(titleLabel)
        view.addSubview(purchase)
    }
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        titleLabel.frame = CGRect(x: 0, y: 150, width: view.bounds.width, height: 60)
        purchase.frame = CGRect(x: view.bounds.midX - 90, y: view.bounds.midY - 30, width: 180, height: 60)
    }
    @objc func buy() { titleLabel.text = "Order confirmed"; purchase.setTitle("Purchased", for: .normal) }
}
@main final class StoryApp: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication, configurationForConnecting session: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let configuration = UISceneConfiguration(name: "Story", sessionRole: session.role)
        configuration.delegateClass = StoryScene.self
        return configuration
    }
}
final class StoryScene: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = StoryViewController()
        window?.makeKeyAndVisible()
    }
}
