import SwiftUI

struct OnboardingView: View {
    @EnvironmentObject var authViewModel: AuthenticationViewModel
    @StateObject private var permissionManager = PermissionManager.shared
    @State private var currentPage = 0
    @State private var isLoading = false
    
    private let totalPages = 5
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Progress indicator
                ProgressView(value: Double(currentPage + 1), total: Double(totalPages))
                    .progressViewStyle(LinearProgressViewStyle(tint: .blue))
                    .padding(.horizontal)
                    .padding(.top)
                
                // Page content
                TabView(selection: $currentPage) {
                    WelcomePageView()
                        .tag(0)
                    
                    FeatureOverviewPageView()
                        .tag(1)
                    
                    PermissionsPageView()
                        .tag(2)
                    
                    CallForwardingPageView()
                        .tag(3)
                    
                    CompletionPageView()
                        .tag(4)
                }
                .tabViewStyle(PageTabViewStyle(indexDisplayMode: .never))
                .animation(.easeInOut, value: currentPage)
                
                // Navigation buttons
                HStack {
                    if currentPage > 0 {
                        Button("Back") {
                            withAnimation {
                                currentPage -= 1
                            }
                        }
                        .foregroundColor(.blue)
                    }
                    
                    Spacer()
                    
                    if currentPage < totalPages - 1 {
                        Button("Next") {
                            withAnimation {
                                currentPage += 1
                            }
                        }
                        .foregroundColor(.blue)
                        .fontWeight(.semibold)
                    } else {
                        Button(action: completeOnboarding) {
                            HStack {
                                if isLoading {
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                        .scaleEffect(0.8)
                                } else {
                                    Text("Get Started")
                                        .fontWeight(.semibold)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.blue)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                        }
                        .disabled(isLoading)
                    }
                }
                .padding()
            }
            .navigationBarHidden(true)
            .environmentObject(permissionManager)
        }
    }
    
    private func completeOnboarding() {
        Task {
            isLoading = true
            await authViewModel.completeOnboarding()
            isLoading = false
        }
    }
}

// MARK: - Welcome Page

struct WelcomePageView: View {
    var body: some View {
        VStack(spacing: 32) {
            Spacer()
            
            // App icon and title
            VStack(spacing: 16) {
                Image(systemName: "phone.badge.checkmark")
                    .font(.system(size: 100))
                    .foregroundColor(.blue)
                
                Text("Welcome to Project Friday")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .multilineTextAlignment(.center)
                
                Text("Your AI-powered call screening assistant")
                    .font(.title2)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            
            Spacer()
            
            // Key benefits
            VStack(alignment: .leading, spacing: 16) {
                BenefitRow(icon: "shield.checkered", text: "Block spam and unwanted calls")
                BenefitRow(icon: "brain.head.profile", text: "AI screens calls intelligently")
                BenefitRow(icon: "bell.badge", text: "Get notified of important calls")
                BenefitRow(icon: "clock", text: "Save time and focus on what matters")
            }
            
            Spacer()
        }
        .padding()
    }
}

// MARK: - Feature Overview Page

struct FeatureOverviewPageView: View {
    var body: some View {
        ScrollView {
            VStack(spacing: 32) {
                VStack(spacing: 16) {
                    Text("How It Works")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                    
                    Text("Project Friday uses advanced AI to screen your calls and protect your time")
                        .font(.body)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.top)
                
                VStack(spacing: 24) {
                    FeatureCard(
                        icon: "phone.arrow.down.left",
                        title: "Incoming Call Detection",
                        description: "When someone calls, our AI immediately engages to identify the purpose"
                    )
                    
                    FeatureCard(
                        icon: "brain",
                        title: "Intelligent Screening",
                        description: "AI converses with callers to determine if the call is important or spam"
                    )
                    
                    FeatureCard(
                        icon: "bell.badge",
                        title: "Smart Notifications",
                        description: "You're only notified of calls that matter, with a summary of why they called"
                    )
                    
                    FeatureCard(
                        icon: "person.badge.plus",
                        title: "Contact Recognition",
                        description: "Known contacts are automatically allowed through without screening"
                    )
                }
                
                Spacer(minLength: 100)
            }
            .padding()
        }
    }
}

// MARK: - Permissions Page

struct PermissionsPageView: View {
    @EnvironmentObject var permissionManager: PermissionManager
    
    var body: some View {
        ScrollView {
            VStack(spacing: 32) {
                VStack(spacing: 16) {
                    Text("Permissions")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                    
                    Text("To provide the best experience, Project Friday needs access to these device features")
                        .font(.body)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.top)
                
                VStack(spacing: 16) {
                    ForEach(PermissionType.allCases, id: \.self) { permissionType in
                        PermissionCard(permissionType: permissionType)
                    }
                }
                
                if permissionManager.hasAnyPermissionDenied {
                    VStack(spacing: 16) {
                        Text("Permission Denied")
                            .font(.headline)
                            .foregroundColor(.orange)
                        
                        Text("Some permissions were denied. You can enable them later in Settings if needed.")
                            .font(.body)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                        
                        Button("Open Settings") {
                            permissionManager.openAppSettings()
                        }
                        .padding(.horizontal, 24)
                        .padding(.vertical, 8)
                        .background(Color.orange.opacity(0.2))
                        .foregroundColor(.orange)
                        .cornerRadius(8)
                    }
                    .padding()
                    .background(Color.orange.opacity(0.1))
                    .cornerRadius(12)
                }
                
                Spacer(minLength: 100)
            }
            .padding()
        }
        .onAppear {
            permissionManager.updatePermissionStatuses()
        }
    }
}

// MARK: - Call Forwarding Page

struct CallForwardingPageView: View {
    var body: some View {
        ScrollView {
            VStack(spacing: 32) {
                VStack(spacing: 16) {
                    Text("Call Forwarding Setup")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                    
                    Text("To screen your calls, we need to set up call forwarding with your carrier")
                        .font(.body)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.top)
                
                VStack(alignment: .leading, spacing: 24) {
                    StepCard(
                        number: 1,
                        title: "Contact Your Carrier",
                        description: "Call your mobile carrier or visit their website to enable call forwarding",
                        details: "Most carriers support call forwarding through their customer service or mobile apps"
                    )
                    
                    StepCard(
                        number: 2,
                        title: "Set Forward Number",
                        description: "Forward unanswered calls to your Project Friday number",
                        details: "We'll provide you with a dedicated number after setup"
                    )
                    
                    StepCard(
                        number: 3,
                        title: "Test the Setup",
                        description: "Make a test call to ensure everything is working correctly",
                        details: "We'll guide you through testing once forwarding is active"
                    )
                }
                
                VStack(spacing: 16) {
                    Text("Common Carrier Codes")
                        .font(.headline)
                    
                    VStack(alignment: .leading, spacing: 8) {
                        CarrierCodeRow(carrier: "Verizon", code: "*72 + forwarding number")
                        CarrierCodeRow(carrier: "AT&T", code: "*21* + forwarding number + #")
                        CarrierCodeRow(carrier: "T-Mobile", code: "**21* + forwarding number + #")
                        CarrierCodeRow(carrier: "Sprint", code: "*72 + forwarding number")
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(12)
                }
                
                Spacer(minLength: 100)
            }
            .padding()
        }
    }
}

// MARK: - Completion Page

struct CompletionPageView: View {
    var body: some View {
        VStack(spacing: 32) {
            Spacer()
            
            VStack(spacing: 24) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 100))
                    .foregroundColor(.green)
                
                Text("You're All Set!")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                Text("Project Friday is ready to protect your time and screen your calls")
                    .font(.body)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            
            VStack(spacing: 16) {
                NextStepRow(icon: "phone.badge.checkmark", text: "Incoming calls will be screened automatically")
                NextStepRow(icon: "bell", text: "You'll receive notifications for important calls")
                NextStepRow(icon: "list.bullet", text: "Review call summaries in your inbox")
                NextStepRow(icon: "gearshape", text: "Customize settings anytime")
            }
            
            Spacer()
        }
        .padding()
    }
}

// MARK: - Supporting Views

struct BenefitRow: View {
    let icon: String
    let text: String
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(.blue)
                .frame(width: 24)
            
            Text(text)
                .font(.body)
                .foregroundColor(.primary)
            
            Spacer()
        }
    }
}

struct FeatureCard: View {
    let icon: String
    let title: String
    let description: String
    
    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(.blue)
                .frame(width: 30)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Text(description)
                    .font(.body)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct PermissionCard: View {
    @EnvironmentObject var permissionManager: PermissionManager
    let permissionType: PermissionType
    @State private var isRequesting = false
    
    var permissionInfo: PermissionInfo {
        permissionManager.getPermissionDescription(for: permissionType)
    }
    
    var body: some View {
        VStack(spacing: 16) {
            HStack(alignment: .top, spacing: 16) {
                Image(systemName: permissionInfo.systemName)
                    .font(.title2)
                    .foregroundColor(.blue)
                    .frame(width: 30)
                
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(permissionInfo.title)
                            .font(.headline)
                            .fontWeight(.semibold)
                        
                        if permissionInfo.isRequired {
                            Text("Required")
                                .font(.caption)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 2)
                                .background(Color.red.opacity(0.2))
                                .foregroundColor(.red)
                                .cornerRadius(4)
                        }
                        
                        Spacer()
                    }
                    
                    Text(permissionInfo.description)
                        .font(.body)
                        .foregroundColor(.secondary)
                    
                    Text("Status: \(permissionInfo.status)")
                        .font(.caption)
                        .foregroundColor(permissionInfo.isGranted ? .green : .orange)
                }
            }
            
            if !permissionInfo.isGranted {
                Button(action: requestPermission) {
                    HStack {
                        if isRequesting {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                .scaleEffect(0.8)
                        } else {
                            Text("Grant Permission")
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(8)
                }
                .disabled(isRequesting)
            } else {
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                    Text("Permission Granted")
                        .foregroundColor(.green)
                        .fontWeight(.medium)
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
    
    private func requestPermission() {
        Task {
            isRequesting = true
            
            switch permissionType {
            case .pushNotifications:
                _ = await permissionManager.requestPushNotificationPermission()
            case .contacts:
                _ = await permissionManager.requestContactsPermission()
            }
            
            isRequesting = false
        }
    }
}

struct StepCard: View {
    let number: Int
    let title: String
    let description: String
    let details: String
    
    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            Text("\(number)")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(.white)
                .frame(width: 30, height: 30)
                .background(Color.blue)
                .clipShape(Circle())
            
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Text(description)
                    .font(.body)
                    .foregroundColor(.primary)
                
                Text(details)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct CarrierCodeRow: View {
    let carrier: String
    let code: String
    
    var body: some View {
        HStack {
            Text(carrier)
                .fontWeight(.medium)
                .frame(width: 80, alignment: .leading)
            
            Text(code)
                .font(.system(.body, design: .monospaced))
                .foregroundColor(.blue)
            
            Spacer()
        }
    }
}

struct NextStepRow: View {
    let icon: String
    let text: String
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(.green)
                .frame(width: 24)
            
            Text(text)
                .font(.body)
                .foregroundColor(.primary)
            
            Spacer()
        }
    }
}

#Preview {
    OnboardingView()
        .environmentObject(AuthenticationViewModel())
}