using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Windows.Forms;

namespace GPMToolLauncher
{
    class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            try
            {
                // Lấy thư mục chứa file EXE
                string exeDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
                string parentDir = exeDir;
                
                DirectoryInfo parent = Directory.GetParent(exeDir);
                if (parent != null)
                {
                    parentDir = parent.FullName;
                }
                
                // Nếu đang chạy từ thư mục launcher, lùi về thư mục gốc
                if (exeDir.EndsWith("launcher", StringComparison.OrdinalIgnoreCase))
                {
                    exeDir = parentDir;
                }
                
                string batFile = Path.Combine(exeDir, "start.bat");
                
                if (!File.Exists(batFile))
                {
                    MessageBox.Show(
                        "Không tìm thấy file start.bat tại:\n" + batFile,
                        "Lỗi - GPM Tool",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error
                    );
                    return;
                }
                
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = "cmd.exe";
                psi.Arguments = "/c \"" + batFile + "\"";
                psi.WorkingDirectory = exeDir;
                psi.UseShellExecute = true;
                psi.CreateNoWindow = false;
                
                Process.Start(psi);
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "Lỗi khi khởi động GPM Tool:\n" + ex.Message,
                    "Lỗi - GPM Tool",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        }
    }
}
