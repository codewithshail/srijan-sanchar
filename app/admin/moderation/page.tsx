"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  MessageSquare,
  BookOpen,
  RefreshCw,
  Loader2,
} from "lucide-react";

interface ContentFlag {
  id: string;
  contentType: "story" | "comment";
  contentId: string;
  reason: string;
  description: string | null;
  status: string;
  autoDetected: boolean;
  confidenceScore: number | null;
  createdAt: string;
  content: {
    id: string;
    title?: string;
    preview: string;
    status?: string;
  } | null;
  contentOwner: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  reporter: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

interface ModerationStats {
  byStatus: Record<string, number>;
  byReason: Record<string, number>;
  byContentType: Record<string, number>;
  byDetection: {
    autoDetected: number;
    userReported: number;
  };
  recentActivity: {
    flagsLast7Days: number;
    resolvedLast7Days: number;
  };
  total: number;
  pending: number;
}

interface FlagDetails {
  flag: ContentFlag;
  fullContent: {
    id: string;
    title?: string;
    content: string;
    status?: string;
    storyId?: string;
    storyTitle?: string;
    createdAt: string;
  } | null;
  contentOwner: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    clerkId: string;
  } | null;
}

export default function ModerationPage() {
  const [flags, setFlags] = useState<ContentFlag[]>([]);
  const [stats, setStats] = useState<ModerationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedFlag, setSelectedFlag] = useState<FlagDetails | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [moderatorNotes, setModeratorNotes] = useState("");

  const fetchFlags = async (status: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/moderation?status=${status}`);
      if (!response.ok) throw new Error("Failed to fetch flags");
      const data = await response.json();
      setFlags(data.flags);
    } catch (error) {
      toast.error("Failed to load moderation queue");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/admin/moderation/stats");
      if (!response.ok) throw new Error("Failed to fetch stats");
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  const fetchFlagDetails = async (flagId: string) => {
    try {
      const response = await fetch(`/api/admin/moderation/${flagId}`);
      if (!response.ok) throw new Error("Failed to fetch flag details");
      const data = await response.json();
      setSelectedFlag(data);
      setDetailsOpen(true);
    } catch (error) {
      toast.error("Failed to load flag details");
    }
  };

  const handleAction = async (flagId: string, action: "approve" | "reject") => {
    try {
      setActionLoading(true);
      const response = await fetch(`/api/admin/moderation/${flagId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, moderatorNotes }),
      });

      if (!response.ok) throw new Error("Failed to process action");

      toast.success(
        action === "approve"
          ? "Content approved - flag dismissed"
          : "Content rejected and removed"
      );

      setDetailsOpen(false);
      setModeratorNotes("");
      fetchFlags(activeTab);
      fetchStats();
    } catch (error) {
      toast.error("Failed to process moderation action");
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchFlags(activeTab);
    fetchStats();
  }, [activeTab]);

  const getReasonBadgeColor = (reason: string) => {
    const colors: Record<string, string> = {
      spam: "bg-yellow-100 text-yellow-800",
      inappropriate: "bg-red-100 text-red-800",
      harassment: "bg-orange-100 text-orange-800",
      hate_speech: "bg-red-200 text-red-900",
      violence: "bg-red-100 text-red-800",
      misinformation: "bg-blue-100 text-blue-800",
      copyright: "bg-purple-100 text-purple-800",
      other: "bg-gray-100 text-gray-800",
    };
    return colors[reason] || colors.other;
  };

  const formatReason = (reason: string) => {
    return reason.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Content Moderation
          </h1>
          <p className="text-muted-foreground mt-1">
            Review and moderate flagged content
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            fetchFlags(activeTab);
            fetchStats();
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Review
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {stats.pending}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Flags
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Auto-Detected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {stats.byDetection.autoDetected}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Resolved (7 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.recentActivity.resolvedLast7Days}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Moderation Queue */}
      <Card>
        <CardHeader>
          <CardTitle>Moderation Queue</CardTitle>
          <CardDescription>
            Review flagged content and take appropriate action
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="pending">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Pending ({stats?.pending || 0})
              </TabsTrigger>
              <TabsTrigger value="approved">
                <CheckCircle className="h-4 w-4 mr-2" />
                Approved
              </TabsTrigger>
              <TabsTrigger value="rejected">
                <XCircle className="h-4 w-4 mr-2" />
                Rejected
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : flags.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No {activeTab} flags found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Content Preview</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Reporter</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {flags.map((flag) => (
                      <TableRow key={flag.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {flag.contentType === "story" ? (
                              <BookOpen className="h-4 w-4" />
                            ) : (
                              <MessageSquare className="h-4 w-4" />
                            )}
                            <span className="capitalize">{flag.contentType}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {flag.content?.title || flag.content?.preview || "N/A"}
                        </TableCell>
                        <TableCell>
                          <Badge className={getReasonBadgeColor(flag.reason)}>
                            {formatReason(flag.reason)}
                          </Badge>
                          {flag.autoDetected && (
                            <Badge variant="outline" className="ml-2">
                              Auto
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {flag.autoDetected
                            ? "System"
                            : flag.reporter
                            ? `${flag.reporter.firstName || ""} ${
                                flag.reporter.lastName || ""
                              }`.trim() || "Anonymous"
                            : "Anonymous"}
                        </TableCell>
                        <TableCell>
                          {new Date(flag.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchFlagDetails(flag.id)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Flag Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Flagged Content</DialogTitle>
            <DialogDescription>
              Review the content and take appropriate action
            </DialogDescription>
          </DialogHeader>

          {selectedFlag && (
            <div className="space-y-4">
              {/* Flag Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Content Type
                  </p>
                  <p className="capitalize">{selectedFlag.flag.contentType}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Reason
                  </p>
                  <Badge className={getReasonBadgeColor(selectedFlag.flag.reason)}>
                    {formatReason(selectedFlag.flag.reason)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Content Owner
                  </p>
                  <p>
                    {selectedFlag.contentOwner
                      ? `${selectedFlag.contentOwner.firstName || ""} ${
                          selectedFlag.contentOwner.lastName || ""
                        }`.trim() || "Unknown"
                      : "Unknown"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Detection
                  </p>
                  <p>
                    {selectedFlag.flag.autoDetected
                      ? `Auto-detected (${selectedFlag.flag.confidenceScore}% confidence)`
                      : "User reported"}
                  </p>
                </div>
              </div>

              {/* Reporter Description */}
              {selectedFlag.flag.description && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Reporter&apos;s Description
                  </p>
                  <p className="text-sm bg-muted p-3 rounded">
                    {selectedFlag.flag.description}
                  </p>
                </div>
              )}

              {/* Full Content */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Full Content
                </p>
                <div className="bg-muted p-4 rounded max-h-60 overflow-y-auto">
                  {selectedFlag.fullContent?.title && (
                    <h3 className="font-semibold mb-2">
                      {selectedFlag.fullContent.title}
                    </h3>
                  )}
                  <p className="whitespace-pre-wrap text-sm">
                    {selectedFlag.fullContent?.content || "Content not available"}
                  </p>
                </div>
              </div>

              {/* Moderator Notes */}
              {selectedFlag.flag.status === "pending" && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Moderator Notes (optional)
                  </p>
                  <Textarea
                    placeholder="Add notes about your decision..."
                    value={moderatorNotes}
                    onChange={(e) => setModeratorNotes(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {selectedFlag?.flag.status === "pending" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setDetailsOpen(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  onClick={() => handleAction(selectedFlag.flag.id, "approve")}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Approve Content
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleAction(selectedFlag.flag.id, "reject")}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-2" />
                  )}
                  Remove Content
                </Button>
              </>
            )}
            {selectedFlag?.flag.status !== "pending" && (
              <Button variant="outline" onClick={() => setDetailsOpen(false)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
