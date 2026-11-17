
import java.io.IOException;
import java.text.DecimalFormat;

import org.apache.hadoop.conf.Configuration;
import org.apache.hadoop.fs.Path;
import org.apache.hadoop.io.Text;
import org.apache.hadoop.mapreduce.Job;
import org.apache.hadoop.mapreduce.Mapper;
import org.apache.hadoop.mapreduce.Reducer;
import org.apache.hadoop.mapreduce.lib.input.FileInputFormat;
import org.apache.hadoop.mapreduce.lib.output.FileOutputFormat;
import org.apache.hadoop.util.GenericOptionsParser;

public class WeatherAnalysis {

    // Parse a weather CSV row:
    // date,station,tmax_c,tmin_c,prcp_mm[,humidity_pct,wind_kmh]
    // (the last two columns are optional so older 5-column files still work)
    static String[] parseRow(String line) {
        String[] fields = line.trim().split(",");
        if (fields.length != 5 && fields.length != 7) {
            return null;
        }
        if (fields[0].equalsIgnoreCase("date")) {
            return null;
        }
        return fields;
    }

    static boolean validNumber(String value) {
        try {
            double number = Double.parseDouble(value.trim());
            return Double.isFinite(number);
        } catch (Exception e) {
            return false;
        }
    }

    static String yearOf(String date) {
        if (date.length() < 4) {
            return "";
        }
        return date.substring(0, 4);
    }

    static String monthOf(String date) {
        if (date.length() < 7) {
            return "";
        }
        return date.substring(0, 7);
    }

    // JOB 1: Yearly temperature statistics per station
    public static class TemperatureMapper
            extends Mapper<Object, Text, Text, Text> {

        private final Text outKey = new Text();
        private final Text outValue = new Text();

        public void map(Object key, Text value, Context context)
                throws IOException, InterruptedException {

            String[] f = parseRow(value.toString());
            if (f == null || !validNumber(f[2]) || !validNumber(f[3])) {
                return;
            }

            String year = yearOf(f[0].trim());
            String station = f[1].trim();
            if (year.isEmpty() || station.isEmpty()) {
                return;
            }

            double tmax = Double.parseDouble(f[2].trim());
            double tmin = Double.parseDouble(f[3].trim());

            outKey.set(station + "-" + year);
            outValue.set(tmax + "," + tmin);
            context.write(outKey, outValue);
        }
    }

    public static class TemperatureReducer
            extends Reducer<Text, Text, Text, Text> {

        public void reduce(Text key, Iterable<Text> values, Context context)
                throws IOException, InterruptedException {

            double sumMax = 0, sumMin = 0;
            double highestMax = Double.NEGATIVE_INFINITY;
            double lowestMax = Double.POSITIVE_INFINITY;
            long count = 0;

            for (Text value : values) {
                String[] parts = value.toString().split(",");
                if (parts.length != 2) continue;

                double tmax = Double.parseDouble(parts[0]);
                double tmin = Double.parseDouble(parts[1]);

                sumMax += tmax;
                sumMin += tmin;
                highestMax = Math.max(highestMax, tmax);
                lowestMax = Math.min(lowestMax, tmax);
                count++;
            }

            if (count == 0) return;

            DecimalFormat df = new DecimalFormat("0.00");
            String result = "avg_tmax=" + df.format(sumMax / count)
                    + ",avg_tmin=" + df.format(sumMin / count)
                    + ",highest_tmax=" + df.format(highestMax)
                    + ",lowest_tmax=" + df.format(lowestMax)
                    + ",observations=" + count;

            context.write(key, new Text(result));
        }
    }

    // JOB 2: Monthly rainfall statistics per station
    public static class RainfallMapper
            extends Mapper<Object, Text, Text, Text> {

        private final Text outKey = new Text();
        private final Text outValue = new Text();

        public void map(Object key, Text value, Context context)
                throws IOException, InterruptedException {

            String[] f = parseRow(value.toString());
            if (f == null || !validNumber(f[4])) return;

            String month = monthOf(f[0].trim());
            String station = f[1].trim();
            if (month.isEmpty() || station.isEmpty()) return;

            double rainfall = Double.parseDouble(f[4].trim());
            int rainyDay = rainfall > 0 ? 1 : 0;

            outKey.set(station + "-" + month);
            outValue.set(rainfall + "," + rainyDay);
            context.write(outKey, outValue);
        }
    }

    public static class RainfallReducer
            extends Reducer<Text, Text, Text, Text> {

        public void reduce(Text key, Iterable<Text> values, Context context)
                throws IOException, InterruptedException {

            double totalRainfall = 0;
            long observations = 0;
            long rainyDays = 0;

            for (Text value : values) {
                String[] parts = value.toString().split(",");
                if (parts.length != 2) continue;

                totalRainfall += Double.parseDouble(parts[0]);
                rainyDays += Long.parseLong(parts[1]);
                observations++;
            }

            DecimalFormat df = new DecimalFormat("0.00");
            String result = "total_rainfall_mm="
                    + df.format(totalRainfall)
                    + ",observations=" + observations
                    + ",rainy_days=" + rainyDays;

            context.write(key, new Text(result));
        }
    }

    // JOB 3: Detect extreme temperature or rainfall observations
    public static class ExtremeMapper
            extends Mapper<Object, Text, Text, Text> {

        private final Text outKey = new Text();
        private final Text outValue = new Text();
        private double heatThreshold;
        private double rainThreshold;
        private double windThreshold;

        // Thresholds can be overridden: -Dweather.heat.threshold=40 -Dweather.rain.threshold=80
        @Override
        protected void setup(Context context) {
            Configuration c = context.getConfiguration();
            heatThreshold = c.getDouble("weather.heat.threshold", 35.0);
            rainThreshold = c.getDouble("weather.rain.threshold", 50.0);
            windThreshold = c.getDouble("weather.wind.threshold", 40.0);
        }

        public void map(Object key, Text value, Context context)
                throws IOException, InterruptedException {

            String[] f = parseRow(value.toString());
            if (f == null) return;

            String date = f[0].trim();
            String station = f[1].trim();

            if (validNumber(f[2])) {
                double tmax = Double.parseDouble(f[2].trim());
                if (tmax >= heatThreshold) {
                    outKey.set(date + "-" + station);
                    outValue.set("EXTREME_HEAT,tmax_c=" + tmax);
                    context.write(outKey, outValue);
                }
            }

            if (validNumber(f[4])) {
                double rainfall = Double.parseDouble(f[4].trim());
                if (rainfall >= rainThreshold) {
                    outKey.set(date + "-" + station);
                    outValue.set("HEAVY_RAIN,prcp_mm=" + rainfall);
                    context.write(outKey, outValue);
                }
            }

            if (f.length == 7 && validNumber(f[6])) {
                double wind = Double.parseDouble(f[6].trim());
                if (wind >= windThreshold) {
                    outKey.set(date + "-" + station);
                    outValue.set("HIGH_WIND,wind_kmh=" + wind);
                    context.write(outKey, outValue);
                }
            }
        }
    }

    // JOB 4: Monthly humidity and wind statistics per station
    public static class AtmosphereMapper
            extends Mapper<Object, Text, Text, Text> {

        private final Text outKey = new Text();
        private final Text outValue = new Text();

        public void map(Object key, Text value, Context context)
                throws IOException, InterruptedException {

            String[] f = parseRow(value.toString());
            if (f == null || f.length != 7
                    || !validNumber(f[5]) || !validNumber(f[6])) return;

            String month = monthOf(f[0].trim());
            String station = f[1].trim();
            if (month.isEmpty() || station.isEmpty()) return;

            outKey.set(station + "-" + month);
            outValue.set(f[5].trim() + "," + f[6].trim());
            context.write(outKey, outValue);
        }
    }

    public static class AtmosphereReducer
            extends Reducer<Text, Text, Text, Text> {

        public void reduce(Text key, Iterable<Text> values, Context context)
                throws IOException, InterruptedException {

            double sumH = 0, sumW = 0;
            double maxH = Double.NEGATIVE_INFINITY, minH = Double.POSITIVE_INFINITY;
            double maxW = Double.NEGATIVE_INFINITY;
            long count = 0;

            for (Text value : values) {
                String[] parts = value.toString().split(",");
                if (parts.length != 2) continue;

                double h = Double.parseDouble(parts[0]);
                double w = Double.parseDouble(parts[1]);
                sumH += h;
                sumW += w;
                maxH = Math.max(maxH, h);
                minH = Math.min(minH, h);
                maxW = Math.max(maxW, w);
                count++;
            }

            if (count == 0) return;

            DecimalFormat df = new DecimalFormat("0.00");
            String result = "avg_humidity=" + df.format(sumH / count)
                    + ",min_humidity=" + df.format(minH)
                    + ",max_humidity=" + df.format(maxH)
                    + ",avg_wind=" + df.format(sumW / count)
                    + ",max_wind=" + df.format(maxW)
                    + ",observations=" + count;

            context.write(key, new Text(result));
        }
    }

    // Each job gets its own input and output directory.
    private static Job createJob(
            Configuration conf,
            String name,
            Class<? extends Mapper> mapperClass,
            Class<? extends Reducer> reducerClass,
            Path input,
            Path output) throws IOException {

        Job job = Job.getInstance(conf, name);
        job.setJarByClass(WeatherAnalysis.class);
        job.setMapperClass(mapperClass);
        job.setReducerClass(reducerClass);
        job.setMapOutputKeyClass(Text.class);
        job.setMapOutputValueClass(Text.class);
        job.setOutputKeyClass(Text.class);
        job.setOutputValueClass(Text.class);
        FileInputFormat.addInputPath(job, input);
        FileOutputFormat.setOutputPath(job, output);
        return job;
    }

    public static void main(String[] args) throws Exception {

        Configuration conf = new Configuration();
        args = new GenericOptionsParser(conf, args).getRemainingArgs();

        if (args.length != 4 && args.length != 5) {
            System.err.println(
                "Usage: WeatherAnalysis <input> <temperature-output> "
                + "<rainfall-output> <extremes-output> [atmosphere-output]");
            System.exit(2);
        }

        Job temperature = createJob(
            conf, "Weather Temperature Analysis",
            TemperatureMapper.class, TemperatureReducer.class,
            new Path(args[0]), new Path(args[1]));

        if (!temperature.waitForCompletion(true)) {
            System.exit(1);
        }

        Job rainfall = createJob(
            conf, "Weather Rainfall Analysis",
            RainfallMapper.class, RainfallReducer.class,
            new Path(args[0]), new Path(args[2]));

        if (!rainfall.waitForCompletion(true)) {
            System.exit(1);
        }

        Job extremes = createJob(
            conf, "Weather Extreme Events Analysis",
            ExtremeMapper.class, Reducer.class,
            new Path(args[0]), new Path(args[3]));

        if (!extremes.waitForCompletion(true)) {
            System.exit(1);
        }

        if (args.length == 5) {
            Job atmosphere = createJob(
                conf, "Weather Humidity and Wind Analysis",
                AtmosphereMapper.class, AtmosphereReducer.class,
                new Path(args[0]), new Path(args[4]));

            if (!atmosphere.waitForCompletion(true)) {
                System.exit(1);
            }
        }
    }
}

