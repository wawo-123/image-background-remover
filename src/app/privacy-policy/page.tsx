export const metadata = {
  title: "隐私政策 - 图片处理工具",
  description: "图片处理工具隐私政策",
};

export default function PrivacyPolicy() {
  return (
    <main style={{ 
      maxWidth: "800px", 
      margin: "0 auto", 
      padding: "40px 20px",
      fontFamily: "system-ui, -apple-system, sans-serif",
      lineHeight: "1.6",
      color: "#333"
    }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "20px" }}>隐私政策</h1>
      <p style={{ color: "#666", marginBottom: "30px" }}>最后更新时间：2026年4月7日</p>

      <section style={{ marginBottom: "30px" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "15px" }}>一、我们收集的信息</h2>
        <p>我们仅在您主动上传图片时处理您的图像文件。所有上传的图片仅用于执行您请求的处理操作（如背景移除、证件照生成等），不会存储、上传或分享给任何第三方。</p>
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "15px" }}>二、信息使用方式</h2>
        <p>您上传的图片仅在处理完成后返回给您。我们不会将您的图片用于任何机器学习训练、人工智能模型改进或其他目的。</p>
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "15px" }}>三、Google OAuth 登录</h2>
        <p>当您使用 Google 账号登录时，我们仅获取您的基本公开信息（姓名、邮箱、头像）用于用户身份识别。我们不会访问您的 Google Drive 或其他隐私数据。</p>
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "15px" }}>四、Cookie 和本地存储</h2>
        <p>我们使用必要的 Cookie 来维护您的登录状态。您的图片处理偏好设置会保存在本地浏览器中，不会发送到我们的服务器。</p>
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "15px" }}>五、数据安全</h2>
        <p>我们采用行业标准的安全措施保护您的数据。图片处理在浏览器端或我们的安全服务器上执行，处理完成后立即删除。</p>
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "15px" }}>六、联系我们</h2>
        <p>如有任何隐私相关问题，请通过网站联系页面与我们沟通。</p>
      </section>

      <div style={{ marginTop: "40px", padding: "20px", background: "#f5f5f5", borderRadius: "8px" }}>
        <p style={{ margin: 0 }}>© 2026 图片处理工具. All rights reserved.</p>
      </div>
    </main>
  );
}