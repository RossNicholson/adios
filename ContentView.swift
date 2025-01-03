struct ContentView: View {
    var body: some View {
        VStack {
            Image("Icon")
                .resizable()
                .frame(width: 128, height: 128)
                .accessibilityLabel("Adios Ad Blocker Icon")
            Text("You can turn on Adios's Safari extension in Settings.")
            // ... rest of the view
        }
    }
}