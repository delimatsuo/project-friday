import SwiftUI
import AuthenticationServices

struct SignInView: View {
    @EnvironmentObject var authViewModel: AuthenticationViewModel
    @State private var email = ""
    @State private var password = ""
    @State private var showingSignUp = false
    @State private var showingPasswordReset = false
    @FocusState private var emailFocused: Bool
    @FocusState private var passwordFocused: Bool
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // App Logo/Title
                    VStack(spacing: 8) {
                        Image(systemName: "phone.badge.checkmark")
                            .font(.system(size: 64))
                            .foregroundColor(.blue)
                        
                        Text("Project Friday")
                            .font(.largeTitle)
                            .fontWeight(.bold)
                        
                        Text("AI-Powered Call Screening")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .padding(.top, 40)
                    
                    // Sign In Form
                    VStack(spacing: 16) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Email")
                                .font(.headline)
                                .foregroundColor(.primary)
                            
                            TextField("Enter your email", text: $email)
                                .textFieldStyle(RoundedBorderTextFieldStyle())
                                .textContentType(.emailAddress)
                                .keyboardType(.emailAddress)
                                .autocapitalization(.none)
                                .focused($emailFocused)
                        }
                        
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Password")
                                .font(.headline)
                                .foregroundColor(.primary)
                            
                            SecureField("Enter your password", text: $password)
                                .textFieldStyle(RoundedBorderTextFieldStyle())
                                .textContentType(.password)
                                .focused($passwordFocused)
                        }
                        
                        Button("Forgot Password?") {
                            showingPasswordReset = true
                        }
                        .font(.caption)
                        .foregroundColor(.blue)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                        
                        Button(action: {
                            Task {
                                await authViewModel.signIn(email: email, password: password)
                            }
                        }) {
                            HStack {
                                if authViewModel.isLoading {
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                        .scaleEffect(0.8)
                                } else {
                                    Text("Sign In")
                                        .fontWeight(.semibold)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.blue)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                        }
                        .disabled(authViewModel.isLoading || email.isEmpty || password.isEmpty)
                    }
                    .padding(.horizontal)
                    
                    // Divider
                    HStack {
                        Rectangle()
                            .frame(height: 1)
                            .foregroundColor(.gray.opacity(0.3))
                        
                        Text("or")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .padding(.horizontal, 16)
                        
                        Rectangle()
                            .frame(height: 1)
                            .foregroundColor(.gray.opacity(0.3))
                    }
                    .padding(.horizontal)
                    
                    // Social Sign In Buttons
                    VStack(spacing: 12) {
                        // Google Sign In
                        Button(action: {
                            Task {
                                await authViewModel.signInWithGoogle()
                            }
                        }) {
                            HStack {
                                Image(systemName: "globe")
                                    .foregroundColor(.red)
                                Text("Sign in with Google")
                                    .fontWeight(.medium)
                                    .foregroundColor(.primary)
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.white)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                            )
                            .cornerRadius(12)
                        }
                        .disabled(authViewModel.isLoading)
                        
                        // Apple Sign In
                        SignInWithAppleButton(
                            onRequest: { _ in },
                            onCompletion: { _ in
                                authViewModel.signInWithApple()
                            }
                        )
                        .frame(height: 50)
                        .cornerRadius(12)
                        .disabled(authViewModel.isLoading)
                    }
                    .padding(.horizontal)
                    
                    // Sign Up Link
                    HStack {
                        Text("Don't have an account?")
                            .foregroundColor(.secondary)
                        
                        Button("Sign Up") {
                            showingSignUp = true
                        }
                        .fontWeight(.medium)
                        .foregroundColor(.blue)
                    }
                    .padding(.top, 16)
                    
                    Spacer(minLength: 0)
                }
                .padding()
            }
            .navigationTitle("")
            .navigationBarHidden(true)
            .alert("Error", isPresented: .constant(authViewModel.errorMessage != nil)) {
                Button("OK") {
                    authViewModel.errorMessage = nil
                }
            } message: {
                if let errorMessage = authViewModel.errorMessage {
                    Text(errorMessage)
                }
            }
            .sheet(isPresented: $showingSignUp) {
                SignUpView()
            }
            .sheet(isPresented: $showingPasswordReset) {
                PasswordResetView()
            }
        }
    }
}

#Preview {
    SignInView()
        .environmentObject(AuthenticationViewModel())
}