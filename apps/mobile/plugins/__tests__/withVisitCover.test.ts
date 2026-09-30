import { type ExpoConfig } from "expo/config";
import { type AndroidManifest, type ExportedConfigWithProps } from "expo/config-plugins";

import withVisitCover, { coverIosResignActive, disableAndroidBackup, secureAndroidActivity } from "../withVisitCover";

const mockNativeResults: unknown[] = [];

jest.mock("expo/config-plugins", () => {
  const actual = jest.requireActual<Record<string, unknown>>("expo/config-plugins");

  const apply =
    <Data>(modResults: Data) =>
    (
      config: ExpoConfig,
      action?: (mod: ExportedConfigWithProps<Data>) => ExportedConfigWithProps<Data>,
    ): ExpoConfig => {
      if (action === undefined) {
        return config;
      }

      const next = action({
        ...config,
        modResults,
        modRequest: {
          projectRoot: "/voter",
          platformProjectRoot: "/voter/native",
          modName: "visit-cover",
          platform: "android",
          introspect: true,
        },
        modRawConfig: config,
      });
      mockNativeResults.push(next.modResults);
      return next;
    };

  return {
    ...actual,
    withAndroidManifest: apply({
      manifest: {
        $: { "xmlns:android": "http://schemas.android.com/apk/res/android" },
        queries: [],
        application: [{ $: { "android:name": ".MainApplication" } }],
      },
    }),
    withMainActivity: apply({
      contents: "import android.os.Build\nsetTheme(R.style.AppTheme);\n",
      language: "kt",
    }),
    withAppDelegate: apply({
      contents: "import React\nclass ReactNativeDelegate",
      language: "swift",
    }),
  };
});

const mainActivity = `package com.example

import android.os.Build
import android.os.Bundle

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    setTheme(R.style.AppTheme);
    super.onCreate(null)
  }
}
`;

const appDelegate = `internal import Expo
import React

class AppDelegate: ExpoAppDelegate {
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
}
`;

const androidManifest = (): AndroidManifest => ({
  manifest: {
    $: { "xmlns:android": "http://schemas.android.com/apk/res/android" },
    queries: [],
    application: [{ $: { "android:name": ".MainApplication" } }],
  },
});

describe("visit cover native project", () => {
  it("turns off Android backup", () => {
    const manifest = disableAndroidBackup(androidManifest());

    expect(manifest.manifest.application?.[0]?.$["android:allowBackup"]).toBe("false");
  });

  it("hides the Android app-switcher preview", () => {
    const secured = secureAndroidActivity(mainActivity);

    expect(secured).toContain("import android.view.WindowManager");
    expect(secured).toContain("window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)");
    expect(secureAndroidActivity(secured)).toBe(secured);
  });

  it("covers iOS before the app resigns active", () => {
    const covered = coverIosResignActive(appDelegate);

    expect(covered).toContain("import UIKit");
    expect(covered).toContain("applicationWillResignActive");
    expect(covered).toContain("visitCoverWindow");
    expect(coverIosResignActive(covered)).toBe(covered);
  });

  it("keeps a manifest that has no application", () => {
    const manifest = disableAndroidBackup({
      manifest: {
        $: { "xmlns:android": "http://schemas.android.com/apk/res/android" },
        queries: [],
      },
    });

    expect(manifest.manifest.application).toBeUndefined();
  });

  it("refuses to cover an Android activity that has no splash theme", () => {
    expect(() => secureAndroidActivity("package com.example\n")).toThrow("MainActivity is missing setTheme");
  });

  it("does not import WindowManager twice", () => {
    const withImport = mainActivity.replace(
      "import android.os.Build\n",
      "import android.os.Build\nimport android.view.WindowManager\n",
    );
    const secured = secureAndroidActivity(withImport);

    expect(secured.match(/import android\.view\.WindowManager/g)).toHaveLength(1);
    expect(secured).toContain("FLAG_SECURE");
  });

  it("refuses to cover an AppDelegate that has no React Native delegate", () => {
    expect(() => coverIosResignActive("import React\n")).toThrow("AppDelegate is missing ReactNativeDelegate");
  });

  it("does not import UIKit twice", () => {
    const covered = coverIosResignActive(appDelegate.replace("import React\n", "import React\nimport UIKit\n"));

    expect(covered.match(/import UIKit/g)).toHaveLength(1);
    expect(covered).toContain("visitCoverWindow");
  });

  it("writes the cover into the generated native project", () => {
    mockNativeResults.length = 0;

    withVisitCover({ name: "MACI voter client", slug: "maci-voter" });

    expect(JSON.stringify(mockNativeResults)).toContain('"android:allowBackup":"false"');
    expect(JSON.stringify(mockNativeResults)).toContain("FLAG_SECURE");
    expect(JSON.stringify(mockNativeResults)).toContain("visitCoverWindow");
  });
});
