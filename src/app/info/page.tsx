
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, Lock, Zap, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function InfoPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-start bg-background p-4 sm:p-6 md:p-8 overflow-y-auto">
      <Card className="w-full max-w-3xl shadow-xl">
        <CardHeader className="text-center border-b pb-4">
          <div className="inline-flex items-center justify-center mb-3">
            <ShieldCheck className="h-16 w-16 text-primary" strokeWidth={1.5} />
          </div>
          <CardTitle className="text-3xl font-bold text-primary font-headline">
            WickerSphere: Security & Privacy
          </CardTitle>
          <CardDescription className="text-md text-muted-foreground pt-1">
            Understanding how WickerSphere protects your conversations.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-8 text-foreground">
          <section>
            <h2 className="text-xl font-semibold mb-2 flex items-center">
              <Lock size={20} className="mr-2 text-primary" /> End-to-End Encryption (E2EE)
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              All messages in WickerSphere are end-to-end encrypted. This means that only you and the person you're communicating with can read what's sent, and nobody in between – not even WickerSphere. Your messages are encrypted on your device before they are sent and decrypted on the recipient's device. We use the robust AES-GCM encryption algorithm, deriving unique keys for each chat to ensure your conversations remain confidential.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2 flex items-center">
              <Zap size={20} className="mr-2 text-primary" /> Ephemeral Messaging
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              WickerSphere embraces the principle of "leaving no trace." You have granular control over how long your messages exist:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-2 pl-4">
              <li><strong>Expiration Timers:</strong> Set messages to automatically delete after a specific period (e.g., 1 minute, 1 hour, 1 day). The default is 1 minute.</li>
              <li><strong>Burn on Read:</strong> Enable this option for messages to be deleted immediately after they are read by the recipient.</li>
              <li><strong>Manual Control:</strong> You can always choose "Never" for expiration if you wish for a message to persist until manually deleted (feature coming soon) or if the chat is cleared.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-2">
              This helps minimize your digital footprint and enhances privacy.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold mb-2 flex items-center">
              <EyeOff size={20} className="mr-2 text-primary" /> Data Handling & Anonymity
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              WickerSphere is designed with privacy at its core:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-2 pl-4">
              <li><strong>Minimal Data Storage:</strong> We only store the encrypted message content necessary for delivery. Once a message expires or is burned, it's gone.</li>
              <li><strong>Username-Based Accounts:</strong> While we use an email format internally for Firebase Authentication, your primary identifier visible to other users is your chosen username.</li>
              <li><strong>Guest Access:</strong> You can use WickerSphere as a guest, further enhancing anonymity for casual conversations.</li>
              <li><strong>No Account Recovery for Passwords:</strong> To maximize security and ensure we cannot access your account, password recovery is not possible. Please store your password securely.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">Our Commitment</h2>
            <p className="text-muted-foreground leading-relaxed">
              We are committed to providing a secure and private messaging platform. While no system can be 100% immune to all threats, we strive to implement best practices in security and cryptography to protect your data and privacy.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              If you have any security concerns or questions, please don't hesitate to reach out (contact method TBD).
            </p>
          </section>
          
          <div className="text-center pt-4">
            <Button asChild variant="outline">
              <Link href="/chat">
                <ArrowLeft size={16} className="mr-2" /> Back to Chats
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
