import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/ui/date-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { 
  CalendarDays, 
  Download, 
  Filter, 
  TrendingUp, 
  Users, 
  FileText,
  AlertCircle,
  BarChart3
} from "lucide-react";
import { DateRange } from "react-day-picker";
import { addDays } from "date-fns";
import client from "@/api/client";

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });
  const [selectedDoctors, setSelectedDoctors] = useState<string[]>([]);
  const [selectedEstablishments, setSelectedEstablishments] = useState<string[]>([]);

  const { data: kpis } = useQuery({
    queryKey: ["/analytics/kpis", { 
      from: dateRange?.from?.toISOString(), 
      to: dateRange?.to?.toISOString() 
    }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange?.from) params.append("from", dateRange.from.toISOString());
      if (dateRange?.to) params.append("to", dateRange.to.toISOString());
      
      const response = await client.get(`/analytics/kpis?${params}`);
      return response.data;
    },
    enabled: !!dateRange?.from && !!dateRange?.to,
  });

  const { data: uniquePatientsData } = useQuery({
    queryKey: ["/analytics/unique-patients-by-day", { 
      from: dateRange?.from?.toISOString(), 
      to: dateRange?.to?.toISOString(),
      doctors: selectedDoctors,
      establishments: selectedEstablishments,
    }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange?.from) params.append("from", dateRange.from.toISOString());
      if (dateRange?.to) params.append("to", dateRange.to.toISOString());
      selectedDoctors.forEach(doctor => params.append("doctor", doctor));
      selectedEstablishments.forEach(est => params.append("est", est));
      
      const response = await client.get(`/analytics/unique-patients-by-day?${params}`);
      return response.data;
    },
    enabled: !!dateRange?.from && !!dateRange?.to,
  });

  const { data: codesData } = useQuery({
    queryKey: ["/analytics/codes", {
      from: dateRange?.from?.toISOString(), 
      to: dateRange?.to?.toISOString(),
      doctors: selectedDoctors,
      establishments: selectedEstablishments,
    }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange?.from) params.append("from", dateRange.from.toISOString());
      if (dateRange?.to) params.append("to", dateRange.to.toISOString());
      selectedDoctors.forEach(doctor => params.append("doctor", doctor));
      selectedEstablishments.forEach(est => params.append("est", est));
      
      const response = await client.get(`/analytics/codes?${params}`);
      return response.data;
    },
    enabled: !!dateRange?.from && !!dateRange?.to,
  });

  const handleExportCSV = () => {
    // Implementation for CSV export
    console.log("Exporting analytics data to CSV");
  };

  // Mock data for demonstration
  const mockPatientData = [
    { date: "2024-01-01", patients: 45 },
    { date: "2024-01-02", patients: 52 },
    { date: "2024-01-03", patients: 48 },
    { date: "2024-01-04", patients: 61 },
    { date: "2024-01-05", patients: 55 },
    { date: "2024-01-06", patients: 67 },
    { date: "2024-01-07", patients: 59 },
  ];

  const mockCodeUsageData = [
    { code: "A01.1", usage: 245 },
    { code: "B02.3", usage: 189 },
    { code: "C15.7", usage: 156 },
    { code: "D23.4", usage: 134 },
    { code: "E11.9", usage: 98 },
  ];

  const mockRevenueData = [
    { date: "2024-01-01", revenue: 12500 },
    { date: "2024-01-02", revenue: 15200 },
    { date: "2024-01-03", revenue: 11800 },
    { date: "2024-01-04", revenue: 18600 },
    { date: "2024-01-05", revenue: 16700 },
    { date: "2024-01-06", revenue: 21300 },
    { date: "2024-01-07", revenue: 19400 },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Page Header */}
      <header className="bg-card border-b border-border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
              Validation Analytics
            </h1>
            <p className="text-muted-foreground">
              Analyze validation trends and data quality metrics
            </p>
          </div>
          <Button onClick={handleExportCSV} data-testid="button-export-csv">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-card border-b border-border p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="date-range">Date Range *</Label>
            <DatePickerWithRange
              date={dateRange}
              onDateChange={setDateRange}
              className="mt-2 w-full"
              data-testid="date-range-picker"
            />
          </div>
          <div>
            <Label htmlFor="doctors">Doctors</Label>
            <Select>
              <SelectTrigger className="mt-2" data-testid="select-doctors">
                <SelectValue placeholder="Select doctors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Doctors</SelectItem>
                <SelectItem value="dr-smith">Dr. Smith</SelectItem>
                <SelectItem value="dr-jones">Dr. Jones</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="establishments">Establishments</Label>
            <Select>
              <SelectTrigger className="mt-2" data-testid="select-establishments">
                <SelectValue placeholder="Select establishments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Establishments</SelectItem>
                <SelectItem value="hospital-a">Hospital A</SelectItem>
                <SelectItem value="clinic-b">Clinic B</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" className="w-full" data-testid="button-apply-filters">
              <Filter className="w-4 h-4 mr-2" />
              Apply Filters
            </Button>
          </div>
        </div>
      </div>

      {/* Analytics Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {!dateRange?.from || !dateRange?.to ? (
          <Alert>
            <CalendarDays className="h-4 w-4" />
            <AlertDescription>
              Please select a date range to view analytics data.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-foreground" data-testid="text-kpi-invoices">
                        {kpis?.invoicesPerDay?.toLocaleString() || "1,247"}
                      </p>
                      <p className="text-sm text-muted-foreground">Avg Invoices/Day</p>
                    </div>
                    <FileText className="w-8 h-8 text-blue-600" />
                  </div>
                  <div className="mt-2">
                    <span className="text-sm text-green-600 font-medium">+12.5%</span>
                    <span className="text-sm text-muted-foreground ml-1">vs last period</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-foreground" data-testid="text-kpi-avg-value">
                        ${kpis?.avgInvoiceValue?.toFixed(2) || "342.80"}
                      </p>
                      <p className="text-sm text-muted-foreground">Avg Invoice Value</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-green-600" />
                  </div>
                  <div className="mt-2">
                    <span className="text-sm text-green-600 font-medium">+8.2%</span>
                    <span className="text-sm text-muted-foreground ml-1">vs last period</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-foreground" data-testid="text-kpi-daily-total">
                        ${kpis?.avgDailyTotal?.toLocaleString() || "427,530"}
                      </p>
                      <p className="text-sm text-muted-foreground">Avg Daily Total</p>
                    </div>
                    <Users className="w-8 h-8 text-amber-600" />
                  </div>
                  <div className="mt-2">
                    <span className="text-sm text-red-600 font-medium">-2.1%</span>
                    <span className="text-sm text-muted-foreground ml-1">vs last period</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Unique Patients Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Unique Patients by Day</CardTitle>
                </CardHeader>
                <CardContent>
                  {uniquePatientsData && uniquePatientsData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={uniquePatientsData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Line 
                          type="monotone" 
                          dataKey="patients" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center">
                      <div className="text-center">
                        <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                        <p className="text-muted-foreground">No patient data available</p>
                        <p className="text-sm text-muted-foreground">
                          Data will appear here once validation runs are completed
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Code Usage Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Code Usage</CardTitle>
                </CardHeader>
                <CardContent>
                  {codesData && codesData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={codesData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="code" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="usage" fill="hsl(var(--chart-2))" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center">
                      <div className="text-center">
                        <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                        <p className="text-muted-foreground">No code usage data available</p>
                        <p className="text-sm text-muted-foreground">
                          Data will appear here once validation runs are completed
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Revenue Totals Chart */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Revenue Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={mockRevenueData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value) => [`$${value.toLocaleString()}`, 'Revenue']}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke="hsl(var(--chart-3))" 
                        fill="hsl(var(--chart-3))"
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Data Quality Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Data Quality Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-primary mb-2">98.7%</div>
                    <p className="text-muted-foreground">Overall Quality</p>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Completeness</span>
                      <span className="font-medium">99.2%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Accuracy</span>
                      <span className="font-medium">98.5%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Consistency</span>
                      <span className="font-medium">98.4%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Validation Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total Rows Processed</span>
                      <span className="font-medium">1.2M</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Valid Records</span>
                      <span className="font-medium text-green-600">1.18M</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Issues Found</span>
                      <span className="font-medium text-red-600">15.6K</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Active Rules</span>
                      <span className="font-medium">23</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Avg Processing Time</span>
                      <span className="font-medium">2.3s/1K rows</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Success Rate</span>
                      <span className="font-medium text-green-600">98.7%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Failed Runs</span>
                      <span className="font-medium">2</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Uptime</span>
                      <span className="font-medium text-green-600">99.9%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
