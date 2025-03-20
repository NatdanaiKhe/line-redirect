import * as ecs from "@8thwall/ecs";

(async function () {
  // Configuration
  const LIFF_ID = "2006122616-D8z3YdeZ"; 
  let lineUserId: string | null = null;
  let lineDisplayName: string | null = null;


  // load LINE LIFF SDK
  function loadLiffSDK(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.liff) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
      script.onload = () => resolve();
      script.onerror = e => reject(new Error("Failed to load LIFF SDK"));
      document.head.appendChild(script);
    });
  }

  // Initialize LIFF 
  async function initializeLiff(): Promise<{
    userId: string;
    displayName: string;
  } | null> {
    try {
      await loadLiffSDK();
      await window.liff.init({ liffId: LIFF_ID });
      console.log("LIFF initialized successfully");

      // Check if user is logged in
      if (!window.liff.isLoggedIn()) {
        console.log("User not logged in, redirecting to LINE login");
        window.liff.login();
        return null;
      }

      // Get user profile 
      const profile = await window.liff.getProfile();
      console.log("User authenticated:", profile.displayName);
      
      return {
        userId: profile.userId,
        displayName: profile.displayName,
      };
    } catch (error) {
      console.error("LIFF initialization or authentication failed", error);
      return null;
    }
  }


  function createUserDisplay(displayName: string): void {
    const userDisplay = document.createElement("div");
    userDisplay.style.position = "fixed";
    userDisplay.style.bottom = "20px";
    userDisplay.style.left = "20px";
    userDisplay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    userDisplay.style.color = "white";
    userDisplay.style.padding = "8px 12px";
    userDisplay.style.borderRadius = "4px";
    userDisplay.style.fontFamily = "Arial, sans-serif";
    userDisplay.style.fontSize = "14px";
    userDisplay.style.zIndex = "1000";
    userDisplay.style.pointerEvents = "none";

    userDisplay.textContent = `User: ${displayName}`;
    document.body.appendChild(userDisplay);

    console.log("User display created for:", displayName);
  }

  // Function to pass LINE user info to 8thWall
  function setupWith8thWall(userId: string, displayName: string): void {
    window.lineUserId = userId;
    window.lineDisplayName = displayName;

    if (window.XR8) {
      window.XR8.lineUserId = userId;
      window.XR8.lineDisplayName = displayName;
    }

    console.log("LINE user info stored for 8thWall:", userId, displayName);
    createUserDisplay(displayName);

    if (window.XR8) {
      window.XR8.addCameraPipelineModule({
        name: "line-auth",
        onStart: () => {
          console.log("8thWall camera started with LINE user:", displayName);
        },
      });
    }
  }

  // Main execution
  try {
    const userInfo = await initializeLiff();
    if (userInfo) {
      lineUserId = userInfo.userId;
      lineDisplayName = userInfo.displayName;
      setupWith8thWall(userInfo.userId, userInfo.displayName);
    }
  } catch (error) {
    console.error("LINE authentication process failed:", error);
  }
})();

// Type
declare global {
  interface Window {
    liff: any;
    lineUserId: string;
    lineDisplayName: string;
    XR8: any;
  }
}


// 8thwall code
const componentsForClone = [
  ecs.Position,
  ecs.Quaternion,
  ecs.Scale,
  ecs.Shadow,
  ecs.BoxGeometry,
  ecs.Material,
  ecs.ScaleAnimation,
  ecs.PositionAnimation,
  ecs.RotateAnimation,
  ecs.CustomPropertyAnimation,
  ecs.CustomVec3Animation,
  ecs.FollowAnimation,
  ecs.LookAtAnimation,
  ecs.GltfModel,
  ecs.Collider,
  ecs.ParticleEmitter,
  ecs.Ui,
  ecs.Audio,
];

const cloneComponents = (sourceEid, targetEid, world) => {
  componentsForClone.forEach(component => {
    if (component.has(world, sourceEid)) {
      const properties = component.get(world, sourceEid);
      component.set(world, targetEid, { ...properties });
    }
  });
};

ecs.registerComponent({
  name: "Tap Place",
  schema: {
    entityToSpawn: ecs.eid, // Entity ID for the entity to spawn
    minScale: ecs.f32, // Minimum scale for the spawned entity
    maxScale: ecs.f32, // Maximum scale for the spawned entity
  },
  schemaDefaults: {
    minScale: 1.0, // Default minimum scale is 1.0
    maxScale: 3.0, // Default maximum scale is 3.0
  },
  data: {
    lastInteractionTime: ecs.f64,
  },
  stateMachine: ({ world, eid, schemaAttribute, dataAttribute }) => {
    ecs
      .defineState("default")
      .initial()
      .onEnter(() => {
        const { entityToSpawn } = schemaAttribute.get(eid);

        if (entityToSpawn) {
          // Disable the entityToSpawn
          ecs.Disabled.set(world, entityToSpawn);
        }
      })
      .listen(eid, ecs.input.SCREEN_TOUCH_START, e => {
        const { entityToSpawn, minScale, maxScale } = schemaAttribute.get(eid);
        const currentTime = Date.now();

        if (currentTime - dataAttribute.get(eid).lastInteractionTime <= 500) {
          return;
        }

        dataAttribute.set(eid, {
          lastInteractionTime: currentTime,
        });

        if (entityToSpawn) {
          const newEntity = world.createEntity();
          const randomScale = Math.random() * (maxScale - minScale) + minScale;

          cloneComponents(entityToSpawn, newEntity, world);

          ecs.Position.set(world, newEntity, e.data.worldPosition);
          ecs.ScaleAnimation.set(world, newEntity, {
            fromX: 0,
            fromY: 0,
            fromZ: 0,
            toX: randomScale,
            toY: randomScale,
            toZ: randomScale,
            duration: 400,
            loop: false,
            easeOut: true,
            easingFunction: "Quadratic",
          });
        } else {
          console.error(
            "Couldn't create a clone. Did you forget to set entityToSpawn in the properties?"
          );
        }
      });
  },
});
