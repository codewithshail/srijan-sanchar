import { Mail, MapPin, Phone } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ContactForm from "@/components/ContactForm";

export const metadata = {
    title: "Contact Us - StoryWeave",
    description: "Get in touch with the StoryWeave team. We're here to help you preserve your legacy.",
};

export default function ContactPage() {
    return (
        <div className="flex flex-col min-h-screen bg-background font-sans">
            <Header />

            <main className="flex-grow pt-24 pb-16">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">

                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-6">
                            Get in Touch
                        </h1>
                        <p className="text-xl text-muted-foreground/90">
                            Have questions about StoryWeave? We'd love to hear from you.
                            Our team is available Monday to Friday, 9am - 6pm IST.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 max-w-6xl mx-auto">

                        {/* Contact Information */}
                        <div className="lg:col-span-1 space-y-8">
                            <div className="p-8 rounded-2xl bg-primary/5 border border-primary/10">
                                <h3 className="text-2xl font-serif font-semibold text-foreground mb-6">
                                    Contact Info
                                </h3>

                                <div className="space-y-6">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 bg-background rounded-full flex items-center justify-center shadow-sm shrink-0">
                                            <Mail className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-foreground">Email Us</h4>
                                            <p className="text-muted-foreground">support@storyweave.com</p>
                                            <p className="text-muted-foreground">hello@storyweave.com</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 bg-background rounded-full flex items-center justify-center shadow-sm shrink-0">
                                            <Phone className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-foreground">Call Us</h4>
                                            <p className="text-muted-foreground">+91 (800) 123-4567</p>
                                            <p className="text-xs text-muted-foreground mt-1">Mon-Fri from 9am to 6pm</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 bg-background rounded-full flex items-center justify-center shadow-sm shrink-0">
                                            <MapPin className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-foreground">Visit Us</h4>
                                            <p className="text-muted-foreground leading-relaxed">
                                                123, Story Lane,<br />
                                                Koramangala, Bangalore,<br />
                                                Karnataka - 560034
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Contact Form */}
                        <div className="lg:col-span-2">
                            <div className="p-8 md:p-10 rounded-2xl bg-card border border-border shadow-sm">
                                <h3 className="text-2xl font-serif font-semibold text-foreground mb-6">
                                    Send us a Message
                                </h3>
                                <ContactForm />
                            </div>
                        </div>

                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
