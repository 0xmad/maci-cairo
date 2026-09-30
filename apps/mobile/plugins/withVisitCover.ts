import {
  type AndroidManifest,
  type ConfigPlugin,
  withAndroidManifest,
  withAppDelegate,
  withMainActivity,
} from "expo/config-plugins";

const iosCover = `
  var visitCoverWindow: UIWindow?

  public override func applicationWillResignActive(_ application: UIApplication) {
    let cover = UIWindow(frame: UIScreen.main.bounds)
    cover.windowLevel = .alert
    cover.backgroundColor = .white
    let controller = UIViewController()
    controller.view.backgroundColor = .white
    cover.rootViewController = controller
    cover.makeKeyAndVisible()
    visitCoverWindow = cover
    super.applicationWillResignActive(application)
  }

  public override func applicationDidBecomeActive(_ application: UIApplication) {
    visitCoverWindow?.isHidden = true
    visitCoverWindow = nil
    super.applicationDidBecomeActive(application)
  }
`;

export const disableAndroidBackup = (androidManifest: AndroidManifest): AndroidManifest => ({
  ...androidManifest,
  manifest: {
    ...androidManifest.manifest,
    application: androidManifest.manifest.application?.map((application) => ({
      ...application,
      $: { ...application.$, "android:allowBackup": "false" },
    })),
  },
});

export const secureAndroidActivity = (contents: string): string => {
  if (contents.includes("FLAG_SECURE")) {
    return contents;
  }

  if (!contents.includes("setTheme(R.style.AppTheme);")) {
    throw new Error("MainActivity is missing setTheme; cannot cover the app switcher");
  }

  const withImport = contents.includes("import android.view.WindowManager\n")
    ? contents
    : contents.replace("import android.os.Build\n", "import android.os.Build\nimport android.view.WindowManager\n");

  return withImport.replace(
    "setTheme(R.style.AppTheme);\n",
    "setTheme(R.style.AppTheme);\n    window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)\n",
  );
};

export const coverIosResignActive = (contents: string): string => {
  if (contents.includes("visitCoverWindow")) {
    return contents;
  }

  const marker = "\nclass ReactNativeDelegate";

  if (!contents.includes(marker)) {
    throw new Error("AppDelegate is missing ReactNativeDelegate; cannot cover the app switcher");
  }

  const withUiKit = contents.includes("import UIKit\n")
    ? contents
    : contents.replace("import React\n", "import React\nimport UIKit\n");

  return withUiKit.replace(marker, `\n${iosCover}\nclass ReactNativeDelegate`);
};

const withVisitCover: ConfigPlugin = (config) => {
  const withoutBackup = withAndroidManifest(config, (mod) => ({
    ...mod,
    modResults: disableAndroidBackup(mod.modResults),
  }));
  const securedActivity = withMainActivity(withoutBackup, (mod) => ({
    ...mod,
    modResults: { ...mod.modResults, contents: secureAndroidActivity(mod.modResults.contents) },
  }));

  return withAppDelegate(securedActivity, (mod) => ({
    ...mod,
    modResults: { ...mod.modResults, contents: coverIosResignActive(mod.modResults.contents) },
  }));
};

export default withVisitCover;
