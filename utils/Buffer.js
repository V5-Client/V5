class StencilUtils {
  static InitStencil() {
    const mc = Client.getMinecraft();
    const framebuffer = mc.getFramebuffer();

    framebuffer.bindFramebuffer(false);
    StencilUtils.CheckSetupFB(framebuffer);

    GL11.glClear(GL11.GL_STENCIL_BUFFER_BIT);
    GL11.glEnable(GL11.GL_STENCIL_TEST);
  }

  static Recreate(framebuffer) {
    GL30.glDeleteRenderbuffers(framebuffer.depthBuffer);

    const depthBuffer = GL30.glGenRenderbuffers();
    GL30.glBindRenderbuffer(GL30.GL_RENDERBUFFER, depthBuffer);

    const mc = Client.getMinecraft();
    const width = mc.getMainWindow().getFramebufferWidth();
    const height = mc.getMainWindow().getFramebufferHeight();

    GL30.glRenderbufferStorage(
      GL30.GL_RENDERBUFFER,
      GL30.GL_DEPTH_STENCIL,
      width,
      height
    );

    GL30.glFramebufferRenderbuffer(
      GL30.GL_FRAMEBUFFER,
      GL30.GL_STENCIL_ATTACHMENT,
      GL30.GL_RENDERBUFFER,
      depthBuffer
    );
    GL30.glFramebufferRenderbuffer(
      GL30.GL_FRAMEBUFFER,
      GL30.GL_DEPTH_ATTACHMENT,
      GL30.GL_RENDERBUFFER,
      depthBuffer
    );
  }

  static CheckSetupFB(framebuffer) {
    if (framebuffer != null) {
      if (framebuffer.depthBuffer > -1) {
        StencilUtils.Recreate(framebuffer);
        framebuffer.depthBuffer = -1;
      }
    }
  }

  static BindWriteStencilBuffer() {
    GL11.glStencilFunc(GL11.GL_ALWAYS, 1, 1);
    GL11.glStencilOp(GL11.GL_REPLACE, GL11.GL_REPLACE, GL11.GL_REPLACE);
    GL11.glColorMask(false, false, false, false);
  }

  static BindReadStencilBuffer(ref) {
    GL11.glColorMask(true, true, true, true);
    GL11.glStencilFunc(GL11.GL_EQUAL, ref, 1);
    GL11.glStencilOp(GL11.GL_KEEP, GL11.GL_KEEP, GL11.GL_KEEP);
  }

  static UninitStencilBuffer() {
    GL11.glDisable(GL11.GL_STENCIL_TEST);
  }
}

global.StencilUtils = new StencilUtils();
