cask "adios" do
  version "0.1.0"
  sha256 "" # auto-populated by CI on each release

  url "https://github.com/rossnicholson/adios/releases/download/v#{version}/Adios-#{version}.dmg"
  name "Adios"
  desc "Open-source ad blocker for Safari on macOS"
  homepage "https://github.com/rossnicholson/adios"

  depends_on macos: ">= :sequoia"

  app "Adios.app"

  postflight do
    puts "Adios installed successfully!"
    puts "Open Adios and enable the extension in Safari Settings → Extensions."
  end

  zap trash: [
    "~/Library/Containers/dev.rossnicholson.Adios",
    "~/Library/Containers/dev.rossnicholson.Adios.Extension",
    "~/Library/Group Containers/dev.rossnicholson.Adios",
  ]
end
