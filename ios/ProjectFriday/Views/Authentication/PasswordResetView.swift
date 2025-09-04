import SwiftUI

struct PasswordResetView: View {
    @Environment(\.presentationMode) var presentationMode
    @EnvironmentObject var authViewModel: AuthenticationViewModel
    
    @State private var email = ""
    @State private var isEmailSent = false
    @FocusState private var emailFocused: Bool
    
    private var isFormValid: Bool {
        !email.isEmpty && isValidEmail(email)
    }
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Header
                    VStack(spacing: 8) {
                        Image(systemName: "lock.rotation")
                            .font(.system(size: 48))
                            .foregroundColor(.blue)
                        
                        Text("Reset Password")
                            .font(.largeTitle)
                            .fontWeight(.bold)
                        
                        Text("Enter your email address and we'll send you a link to reset your password")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, 20)
                    
                    if isEmailSent {
                        // Email Sent Confirmation
                        VStack(spacing: 16) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 64))
                                .foregroundColor(.green)
                            
                            Text("Email Sent!")
                                .font(.title2)
                                .fontWeight(.semibold)
                            
                            Text("We've sent a password reset link to:")
                                .font(.body)
                                .foregroundColor(.secondary)
                            
                            Text(email)
                                .font(.body)
                                .fontWeight(.medium)
                                .foregroundColor(.primary)
                            
                            Text("Please check your email and follow the instructions to reset your password.")
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .multilineTextAlignment(.center)
                            
                            Button("Send Another Email") {
                                Task {
                                    await authViewModel.resetPassword(email: email)
                                }
                            }
                            .foregroundColor(.blue)
                            .padding(.top)
                        }
                        .padding(.horizontal)
                    } else {
                        // Email Input Form
                        VStack(spacing: 16) {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Email Address")
                                    .font(.headline)
                                    .foregroundColor(.primary)
                                
                                TextField("Enter your email", text: $email)
                                    .textFieldStyle(RoundedBorderTextFieldStyle())
                                    .textContentType(.emailAddress)
                                    .keyboardType(.emailAddress)
                                    .autocapitalization(.none)
                                    .focused($emailFocused)
                                
                                if !email.isEmpty && !isValidEmail(email) {
                                    Text("Please enter a valid email address")
                                        .font(.caption)
                                        .foregroundColor(.red)
                                }
                            }
                            
                            Button(action: {
                                Task {
                                    await authViewModel.resetPassword(email: email)
                                    if authViewModel.errorMessage == nil {
                                        isEmailSent = true
                                    }
                                }
                            }) {
                                HStack {
                                    if authViewModel.isLoading {
                                        ProgressView()
                                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                            .scaleEffect(0.8)
                                    } else {
                                        Text("Send Reset Link")
                                            .fontWeight(.semibold)
                                    }
                                }
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(isFormValid ? Color.blue : Color.gray.opacity(0.5))
                                .foregroundColor(.white)
                                .cornerRadius(12)
                            }
                            .disabled(authViewModel.isLoading || !isFormValid)
                        }
                        .padding(.horizontal)
                    }
                    
                    // Back to Sign In
                    if !authViewModel.isLoading {
                        Button("Back to Sign In") {
                            presentationMode.wrappedValue.dismiss()
                        }
                        .foregroundColor(.blue)
                        .padding(.top)
                    }
                    
                    Spacer(minLength: 0)
                }
                .padding()
            }
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarBackButtonHidden(true)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        presentationMode.wrappedValue.dismiss()
                    }
                }
            }
            .alert("Error", isPresented: .constant(authViewModel.errorMessage != nil)) {
                Button("OK") {
                    authViewModel.errorMessage = nil
                }
            } message: {
                if let errorMessage = authViewModel.errorMessage {
                    Text(errorMessage)
                }
            }
            .onAppear {
                emailFocused = true
            }
        }
    }
    
    private func isValidEmail(_ email: String) -> Bool {
        let emailRegex = "[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,64}"
        let emailPredicate = NSPredicate(format: "SELF MATCHES %@", emailRegex)
        return emailPredicate.evaluate(with: email)
    }
}

#Preview {
    PasswordResetView()
        .environmentObject(AuthenticationViewModel())
}