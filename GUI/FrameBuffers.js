// port of the 1.8.9 framebuffers module

const ResourceLocation = net.minecraft.resources.ResourceLocation;

const shaders = {
  blur: new ResourceLocation("shaders/post/blur.json"),
};

const mc = Client.getMinecraft();
const gameRenderer = mc.gameRenderer; // entityrenderer became  gamerenderer
const tessellator = net.minecraft.client.render.Tessellator.getInstance();
const POSITION_TEX = com.mojang.blaze3d.vertex.DefaultVertexFormat.POSITION_TEX;
let worldRenderer;

export class FramebufferUtils {
  static applyPostShader = (shaderName) => {
    gameRenderer;
  };
}
